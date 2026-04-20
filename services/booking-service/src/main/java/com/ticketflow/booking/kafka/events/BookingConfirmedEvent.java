package com.ticketflow.booking.kafka.events;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingConfirmedEvent {
    @Builder.Default
    private String eventType = "booking.confirmed";
    private String bookingId;
    private String userId;
    private String userEmail;
    private String eventId;
    private String eventName;
    private List<String> seatIds;
    private BigDecimal totalAmount;
    @Builder.Default
    private String timestamp = Instant.now().toString();
}
