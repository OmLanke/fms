package com.ticketflow.booking.kafka.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PaymentProcessedEvent {
    private String eventType;
    private String bookingId;
    private String paymentId;
    private String status; // "SUCCESS" or "FAILED"
    private String reason;
    private String timestamp;
}
