package com.ticketflow.booking.kafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SeatsLockedEvent {
    private String eventType;
    private String bookingId;
    private List<String> seatIds;
    private String timestamp;
}
