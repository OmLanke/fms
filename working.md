# System Architecture: TicketFlow

## Overview
TicketFlow use microservices architecture with API Gateway for entry and Kafka for event-driven communication.

## Component Connectivity

### 1. API Gateway (Entry Point)
- **Role:** Single entry for frontend.
- **Connections:** Routes HTTP requests to backend services via REST.
- **Downstream:** 
  - User Service (`:3001`)
  - Event Service (`:3002`)
  - Booking Service (`:3003`)
  - Inventory Service (`:3004`)
  - Payment Service (`:3005`)
  - Notification Service (`:3006`)

### 2. Message Broker (Kafka)
- **Role:** Asynchronous event backbone.
- **Services Connected:** All backend services except Gateway.
- **Key Topics & Flow:**
  - `ticketflow.user.registered` $\rightarrow$ Notification Service
  - `ticketflow.booking.initiated` $\rightarrow$ Inventory Service
  - `ticketflow.seats.locked` $\rightarrow$ Booking Service
  - `ticketflow.payment.requested` $\rightarrow$ Payment Service
  - `ticketflow.payment.processed` $\rightarrow$ Booking/Inventory Service
  - `ticketflow.booking.confirmed` $\rightarrow$ Notification Service

### 3. Microservices & Data Stores
- **User Service:** PostgreSQL (`ticketflow_users`)
- **Event Service:** MongoDB (`ticketflow_events`)
- **Booking Service:** PostgreSQL (`ticketflow_bookings`)
- **Inventory Service:** PostgreSQL (`ticketflow_inventory`) + Redis (Caching)
- **Payment Service:** MongoDB (`ticketflow_payments`)
- **Notification Service:** MongoDB (`ticketflow_notifications`)

## Event-Driven Flow Example (Booking)
1. **User** $\rightarrow$ **Gateway** $\rightarrow$ **Booking Service**: Create booking request.
2. **Booking Service** $\rightarrow$ **Kafka** (`ticketflow.booking.initiated`).
3. **Inventory Service** (consumes `booking.initiated`) $\rightarrow$ Locks seats $\rightarrow$ **Kafka** (`ticketflow.seats.locked`).
4. **Booking Service** (consumes `seats.locked`) $\rightarrow$ Requests payment $\rightarrow$ **Kafka** (`ticketflow.payment.requested`).
5. **Payment Service** (consumes `payment.requested`) $\rightarrow$ Process payment $\rightarrow$ **Kafka** (`ticketflow.payment.processed`).
6. **Booking Service** (consumes `payment.processed`) $\rightarrow$ Confirms booking $\rightarrow$ **Kafka** (`ticketflow.booking.confirmed`).
7. **Notification Service** (consumes `booking.confirmed`) $\rightarrow$ Send email to user.
