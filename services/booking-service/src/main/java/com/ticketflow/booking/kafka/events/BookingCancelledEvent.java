package com.ticketflow.booking.kafka.events;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingCancelledEvent {
    @Builder.Default
    private String eventType = "booking.cancelled";
    private String bookingId;
    private String userId;
    private List<String> seatIds;
    @Builder.Default
    private String timestamp = Instant.now().toString();
}
