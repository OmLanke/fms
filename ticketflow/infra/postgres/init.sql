-- TicketFlow PostgreSQL Initialization
-- Creates all PostgreSQL databases for services that use PostgreSQL

CREATE DATABASE ticketflow_users;
CREATE DATABASE ticketflow_bookings;
CREATE DATABASE ticketflow_inventory;

-- Connect to users DB and create extensions
\connect ticketflow_users
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connect to bookings DB and create extensions
\connect ticketflow_bookings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connect to inventory DB and create extensions
\connect ticketflow_inventory
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
