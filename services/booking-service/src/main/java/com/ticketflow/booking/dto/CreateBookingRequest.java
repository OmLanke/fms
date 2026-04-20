package com.ticketflow.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record CreateBookingRequest(
        @NotBlank String eventId,
        @NotBlank String eventName,
        @NotEmpty List<String> seatIds,
        @NotNull BigDecimal totalAmount
) {}
