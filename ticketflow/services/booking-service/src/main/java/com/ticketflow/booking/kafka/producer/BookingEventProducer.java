package com.ticketflow.booking.kafka.producer;

import com.ticketflow.booking.entity.Booking;
import com.ticketflow.booking.kafka.events.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publishBookingInitiated(Booking booking, List<String> seatIds) {
        BookingInitiatedEvent event = BookingInitiatedEvent.builder()
                .bookingId(booking.getId())
                .userId(booking.getUserId())
                .userEmail(booking.getUserEmail())
                .eventId(booking.getEventId())
                .eventName(booking.getEventName())
                .seatIds(seatIds)
                .totalAmount(booking.getTotalAmount())
                .build();
        kafkaTemplate.send("ticketflow.booking.initiated", booking.getId(), event);
        log.info("Published booking.initiated for bookingId={}", booking.getId());
    }

    public void publishPaymentRequested(Booking booking) {
        PaymentRequestedEvent event = PaymentRequestedEvent.builder()
                .bookingId(booking.getId())
                .userId(booking.getUserId())
                .amount(booking.getTotalAmount())
                .build();
        kafkaTemplate.send("ticketflow.payment.requested", booking.getId(), event);
        log.info("Published payment.requested for bookingId={}", booking.getId());
    }

    public void publishBookingConfirmed(Booking booking) {
        List<String> seatIds = booking.getItems().stream()
                .map(item -> item.getSeatId())
                .toList();
        BookingConfirmedEvent event = BookingConfirmedEvent.builder()
                .bookingId(booking.getId())
                .userId(booking.getUserId())
                .userEmail(booking.getUserEmail())
                .eventId(booking.getEventId())
                .eventName(booking.getEventName())
                .seatIds(seatIds)
                .totalAmount(booking.getTotalAmount())
                .build();
        kafkaTemplate.send("ticketflow.booking.confirmed", booking.getId(), event);
        log.info("Published booking.confirmed for bookingId={}", booking.getId());
    }

    public void publishBookingFailed(Booking booking, String reason) {
        BookingFailedEvent event = BookingFailedEvent.builder()
                .bookingId(booking.getId())
                .userId(booking.getUserId())
                .userEmail(booking.getUserEmail())
                .reason(reason)
                .build();
        kafkaTemplate.send("ticketflow.booking.failed", booking.getId(), event);
        log.info("Published booking.failed for bookingId={}, reason={}", booking.getId(), reason);
    }

    public void publishBookingCancelled(Booking booking) {
        List<String> seatIds = booking.getItems().stream()
                .map(item -> item.getSeatId())
                .toList();
        BookingCancelledEvent event = BookingCancelledEvent.builder()
                .bookingId(booking.getId())
                .userId(booking.getUserId())
                .seatIds(seatIds)
                .build();
        kafkaTemplate.send("ticketflow.booking.cancelled", booking.getId(), event);
        log.info("Published booking.cancelled for bookingId={}", booking.getId());
    }

    public void publishSeatsConfirm(String bookingId, List<String> seatIds) {
        SeatsConfirmEvent event = SeatsConfirmEvent.builder()
                .bookingId(bookingId)
                .seatIds(seatIds)
                .build();
        kafkaTemplate.send("ticketflow.seats.confirm", bookingId, event);
        log.info("Published seats.confirm for bookingId={}", bookingId);
    }

    public void publishSeatsRelease(String bookingId, List<String> seatIds) {
        SeatsReleaseEvent event = SeatsReleaseEvent.builder()
                .bookingId(bookingId)
                .seatIds(seatIds)
                .build();
        kafkaTemplate.send("ticketflow.seats.release", bookingId, event);
        log.info("Published seats.release for bookingId={}", bookingId);
    }
}
