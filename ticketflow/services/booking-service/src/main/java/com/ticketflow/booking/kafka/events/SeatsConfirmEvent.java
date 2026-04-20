package com.ticketflow.booking.kafka.events;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatsConfirmEvent {
    @Builder.Default
    private String eventType = "seats.confirm";
    private String bookingId;
    private List<String> seatIds;
    @Builder.Default
    private String timestamp = Instant.now().toString();
}
