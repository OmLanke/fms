package com.ticketflow.user.dto;

public record AuthResponse(
        String token,
        UserDTO user
) {}
