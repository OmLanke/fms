export const config = {
  port: parseInt(process.env.PORT || "3000"),
  jwtSecret: process.env.JWT_SECRET || "default-secret-change-in-production-min-32-chars",
  services: {
    user: process.env.USER_SERVICE_URL || "http://user-service:3001",
    event: process.env.EVENT_SERVICE_URL || "http://event-service:3002",
    booking: process.env.BOOKING_SERVICE_URL || "http://booking-service:3003",
    inventory: process.env.INVENTORY_SERVICE_URL || "http://inventory-service:3004",
    payment: process.env.PAYMENT_SERVICE_URL || "http://payment-service:3005",
    notification: process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3006",
  },
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 100,
  },
};
