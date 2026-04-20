package com.ticketflow.booking.dto;

import com.ticketflow.booking.entity.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record BookingResponse(
        String id,
        String userId,
        String eventId,
        String eventName,
        BookingStatus status,
        BigDecimal totalAmount,
        List<String> seatIds,
        LocalDateTime createdAt
) {}
