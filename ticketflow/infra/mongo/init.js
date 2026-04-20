// TicketFlow MongoDB Initialization
// Creates all MongoDB databases and collections for services that use MongoDB

// Event Service Database
db = db.getSiblingDB('ticketflow_events');
db.createCollection('events');
db.createCollection('venues');
db.events.createIndex({ "name": "text", "description": "text" });
db.events.createIndex({ "date": 1 });
db.events.createIndex({ "created_at": -1 });
db.venues.createIndex({ "city": 1, "country": 1 });

// Payment Service Database
db = db.getSiblingDB('ticketflow_payments');
db.createCollection('payments');
db.payments.createIndex({ "booking_id": 1 }, { unique: false });
db.payments.createIndex({ "user_id": 1 });
db.payments.createIndex({ "status": 1 });
db.payments.createIndex({ "created_at": -1 });

// Notification Service Database
db = db.getSiblingDB('ticketflow_notifications');
db.createCollection('notifications');
db.notifications.createIndex({ "recipient_email": 1 });
db.notifications.createIndex({ "type": 1 });
db.notifications.createIndex({ "status": 1 });
db.notifications.createIndex({ "created_at": -1 });

print('MongoDB initialization complete for TicketFlow databases');
