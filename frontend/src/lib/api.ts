import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Types
export interface User {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  updatedAt: string
}

export interface Venue {
  id: string
  name: string
  address: string
  city: string
  country: string
  capacity: number
}

export interface Event {
  id: string
  name: string
  description: string
  venueId: string
  venue?: Venue
  date: string
  price: number
  totalSeats: number
  createdAt: string
  updatedAt: string
}

export interface Seat {
  id: string
  eventId: string
  seatNumber: string
  row: string
  status: 'AVAILABLE' | 'LOCKED' | 'RESERVED'
}


export interface Booking {
  id: string
  userId: string
  eventId: string
  eventName: string
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED'
  totalAmount: number
  seatIds: string[]
  createdAt: string
}

// Returned immediately from POST /bookings (202 Accepted)
export interface BookingAccepted {
  id: string
  status: 'PENDING'
}

export interface PaymentOrderRequest {
  booking_id: string
  user_id: string
  amount: number
  currency?: string
}

export interface PaymentOrderResponse {
  payment_id: string
  order_id: string
  amount: number
  currency: string
  razorpay_key_id: string
}

export interface PaymentVerifyRequest {
  payment_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  signature: string
}

export interface PaymentVerifyResponse {
  id: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  providerRef?: string
  updatedAt: string
}

// Auth API
export const authApi = {
  register: async (data: { name: string; email: string; password: string }) => {
    const res = await api.post<{ user: User; token: string }>('/users/register', data)
    return res.data
  },
  login: async (data: { email: string; password: string }) => {
    const res = await api.post<{ token: string }>('/users/login', data)
    return res.data
  },
  getMe: async () => {
    const res = await api.get<{ user: User }>('/users/me')
    return res.data
  },
}

// Events API
export const eventsApi = {
  getAll: async () => {
    const res = await api.get<{ events: Event[] }>('/events')
    return res.data
  },
  getById: async (id: string) => {
    const res = await api.get<Event>(`/events/${id}`)
    return res.data
  },
}

// Inventory API
export const inventoryApi = {
  getSeats: async (eventId: string) => {
    const res = await api.get<{ seats: Seat[] }>(`/inventory/events/${eventId}/seats`)
    return res.data
  },
}

// Bookings API
export const bookingsApi = {
  /**
   * Initiates a booking. Returns 202 Accepted immediately.
   * Use `pollBookingStatus` to wait for the final status.
   */
  create: async (data: { eventId: string; eventName: string; seatIds: string[]; totalAmount: number }): Promise<BookingAccepted> => {
    const res = await api.post<BookingAccepted>('/bookings', data, {
      validateStatus: (status) => status === 202,
    })
    return res.data
  },
  getMyBookings: async () => {
    const res = await api.get<{ bookings: Booking[] }>('/bookings/my')
    return res.data
  },
  getById: async (id: string) => {
    const res = await api.get<Booking>(`/bookings/${id}`)
    return res.data
  },
  cancel: async (id: string) => {
    const res = await api.post<Booking>(`/bookings/${id}/cancel`)
    return res.data
  },
}

export const paymentsApi = {
  createOrder: async (data: PaymentOrderRequest): Promise<PaymentOrderResponse> => {
    const res = await api.post<PaymentOrderResponse>('/payments/create-order', data)
    return res.data
  },
  verify: async (data: PaymentVerifyRequest): Promise<PaymentVerifyResponse> => {
    const res = await api.post<PaymentVerifyResponse>('/payments/verify', data)
    return res.data
  },
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 45_000

export class BookingStatusTimeoutError extends Error {
  bookingId: string

  constructor(bookingId: string) {
    super('Booking is still processing. Check "My Bookings" for the final status.')
    this.name = 'BookingStatusTimeoutError'
    this.bookingId = bookingId
  }
}

/**
 * Polls GET /bookings/:id every 1.5s until the booking leaves PENDING state,
 * or until the timeout is reached.
 */
export async function pollBookingStatus(bookingId: string): Promise<Booking> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const booking = await bookingsApi.getById(bookingId)
    if (booking.status !== 'PENDING') {
      return booking
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  // One last read avoids false timeout errors if status changed right at the boundary.
  try {
    const latest = await bookingsApi.getById(bookingId)
    if (latest.status !== 'PENDING') {
      return latest
    }
  } catch {
    // Ignore final-read errors and treat this as an in-progress timeout.
  }

  throw new BookingStatusTimeoutError(bookingId)
}
