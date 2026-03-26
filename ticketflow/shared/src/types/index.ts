export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  venueId: string;
  venue?: Venue;
  date: string;
  price: number;
  totalSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface Seat {
  id: string;
  eventId: string;
  seatNumber: string;
  row: string;
  status: 'AVAILABLE' | 'LOCKED' | 'RESERVED';
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  totalAmount: number;
  items: BookingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingItem {
  id: string;
  bookingId: string;
  seatId: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
