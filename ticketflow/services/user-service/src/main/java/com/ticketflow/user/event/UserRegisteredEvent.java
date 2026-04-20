package com.ticketflow.user.event;

public record UserRegisteredEvent(
        String eventType,
        String userId,
        String email,
        String name,
        String timestamp
) {
    public UserRegisteredEvent(String userId, String email, String name) {
        this(
                "user.registered",
                userId,
                email,
                name,
                java.time.Instant.now().toString()
        );
    }
}
