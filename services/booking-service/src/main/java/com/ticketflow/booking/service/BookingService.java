package com.ticketflow.booking.service;

import com.ticketflow.booking.dto.BookingResponse;
import com.ticketflow.booking.dto.CreateBookingRequest;
import com.ticketflow.booking.entity.Booking;
import com.ticketflow.booking.entity.BookingItem;
import com.ticketflow.booking.entity.BookingStatus;
import com.ticketflow.booking.kafka.producer.BookingEventProducer;
import com.ticketflow.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final BookingEventProducer producer;

    @Transactional
    public BookingResponse createBooking(String userId, String userEmail, CreateBookingRequest req) {
        Booking booking = Booking.builder()
                .userId(userId)
                .userEmail(userEmail)
                .eventId(req.eventId())
                .eventName(req.eventName())
                .totalAmount(req.totalAmount())
                .status(BookingStatus.PENDING)
                .build();

        List<BookingItem> items = req.seatIds().stream()
                .map(seatId -> BookingItem.builder()
                        .booking(booking)
                        .seatId(seatId)
                        .build())
                .toList();
        booking.setItems(items);

        Booking saved = bookingRepository.save(booking);
        log.info("Created booking id={} for userId={}", saved.getId(), userId);

        producer.publishBookingInitiated(saved, req.seatIds());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBooking(String bookingId, String userId) {
        Booking booking = bookingRepository.findByIdWithItems(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));
        if (!booking.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to booking: " + bookingId);
        }
        return toResponse(booking);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getUserBookings(String userId) {
        return bookingRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BookingResponse cancelBooking(String bookingId, String userId) {
        Booking booking = bookingRepository.findByIdWithItems(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!booking.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to booking: " + bookingId);
        }

        BookingStatus status = booking.getStatus();
        if (status != BookingStatus.PENDING && status != BookingStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot cancel booking in status: " + status);
        }

        booking.setStatus(BookingStatus.CANCELLED);
        bookingRepository.save(booking);

        producer.publishBookingCancelled(booking);

        List<String> seatIds = booking.getItems().stream()
                .map(item -> item.getSeatId())
                .toList();
        producer.publishSeatsRelease(booking.getId(), seatIds);

        log.info("Cancelled booking id={} for userId={}", bookingId, userId);
        return toResponse(booking);
    }

    private BookingResponse toResponse(Booking booking) {
        List<String> seatIds = booking.getItems() != null
                ? booking.getItems().stream().map(BookingItem::getSeatId).toList()
                : List.of();
        return new BookingResponse(
                booking.getId(),
                booking.getUserId(),
                booking.getEventId(),
                booking.getEventName(),
                booking.getStatus(),
                booking.getTotalAmount(),
                seatIds,
                booking.getCreatedAt()
        );
    }
}
