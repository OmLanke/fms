package com.ticketflow.booking.kafka.events;

import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingFailedEvent {
    @Builder.Default
    private String eventType = "booking.failed";
    private String bookingId;
    private String userId;
    private String userEmail;
    private String reason;
    @Builder.Default
    private String timestamp = Instant.now().toString();
}
