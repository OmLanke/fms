package com.ticketflow.booking.kafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SeatsLockFailedEvent {
    private String eventType;
    private String bookingId;
    private String reason;
    private List<String> conflictingSeatIds;
    private String timestamp;
}
