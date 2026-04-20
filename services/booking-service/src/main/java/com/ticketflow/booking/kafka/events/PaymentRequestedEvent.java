package com.ticketflow.booking.kafka.events;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestedEvent {
    @Builder.Default
    private String eventType = "payment.requested";
    private String bookingId;
    private String userId;
    private BigDecimal amount;
    @Builder.Default
    private String currency = "USD";
    @Builder.Default
    private String timestamp = Instant.now().toString();
}
