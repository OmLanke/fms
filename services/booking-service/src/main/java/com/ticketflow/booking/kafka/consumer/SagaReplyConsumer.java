package com.ticketflow.booking.kafka.consumer;

import com.ticketflow.booking.entity.Booking;
import com.ticketflow.booking.entity.BookingStatus;
import com.ticketflow.booking.kafka.events.PaymentProcessedEvent;
import com.ticketflow.booking.kafka.events.SeatsLockFailedEvent;
import com.ticketflow.booking.kafka.events.SeatsLockedEvent;
import com.ticketflow.booking.kafka.producer.BookingEventProducer;
import com.ticketflow.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SagaReplyConsumer {

    private final BookingRepository bookingRepository;
    private final BookingEventProducer producer;

    @Transactional
    @KafkaListener(topics = "ticketflow.seats.locked", groupId = "booking-service")
    public void onSeatsLocked(@Payload SeatsLockedEvent event) {
        log.info("Received seats.locked for bookingId={}", event.getBookingId());
        Booking booking = bookingRepository.findByIdWithItems(event.getBookingId())
                .orElseThrow(() -> {
                    log.error("Booking not found for id={}", event.getBookingId());
                    return new RuntimeException("Booking not found: " + event.getBookingId());
                });

        // Booking stays PENDING, proceed to payment
        producer.publishPaymentRequested(booking);
    }

    @Transactional
    @KafkaListener(topics = "ticketflow.seats.lock-failed", groupId = "booking-service")
    public void onSeatsLockFailed(@Payload SeatsLockFailedEvent event) {
        log.info("Received seats.lock-failed for bookingId={}", event.getBookingId());
        Booking booking = bookingRepository.findByIdWithItems(event.getBookingId())
                .orElseThrow(() -> {
                    log.error("Booking not found for id={}", event.getBookingId());
                    return new RuntimeException("Booking not found: " + event.getBookingId());
                });

        booking.setStatus(BookingStatus.FAILED);
        bookingRepository.save(booking);

        String reason = event.getReason() != null ? event.getReason() : "Seat lock failed";
        producer.publishBookingFailed(booking, reason);
    }

    @Transactional
    @KafkaListener(topics = "ticketflow.payment.processed", groupId = "booking-service")
    public void onPaymentProcessed(@Payload PaymentProcessedEvent event) {
        log.info("Received payment.processed for bookingId={}, status={}", event.getBookingId(), event.getStatus());
        Booking booking = bookingRepository.findByIdWithItems(event.getBookingId())
                .orElseThrow(() -> {
                    log.error("Booking not found for id={}", event.getBookingId());
                    return new RuntimeException("Booking not found: " + event.getBookingId());
                });

        List<String> seatIds = booking.getItems().stream()
                .map(item -> item.getSeatId())
                .toList();

        if ("SUCCESS".equalsIgnoreCase(event.getStatus())) {
            booking.setStatus(BookingStatus.CONFIRMED);
            bookingRepository.save(booking);
            producer.publishBookingConfirmed(booking);
            producer.publishSeatsConfirm(booking.getId(), seatIds);
        } else {
            booking.setStatus(BookingStatus.FAILED);
            bookingRepository.save(booking);
            String reason = event.getReason() != null ? event.getReason() : "Payment failed";
            producer.publishBookingFailed(booking, reason);
            producer.publishSeatsRelease(booking.getId(), seatIds);
        }
    }
}
