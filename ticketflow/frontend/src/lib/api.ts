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

export interface BookingItem {
  id: string
  bookingId: string
  seatId: string
}

export interface Booking {
  id: string
  userId: string
  eventId: string
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED'
  totalAmount: number
  items: BookingItem[]
  createdAt: string
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
    const res = await api.get<{ event: Event }>(`/events/${id}`)
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
  create: async (data: { eventId: string; seatIds: string[] }) => {
    const res = await api.post<{ booking: Booking }>('/bookings', data)
    return res.data
  },
  getMyBookings: async () => {
    const res = await api.get<{ bookings: Booking[] }>('/bookings/my')
    return res.data
  },
  getById: async (id: string) => {
    const res = await api.get<{ booking: Booking }>(`/bookings/${id}`)
    return res.data
  },
  cancel: async (id: string) => {
    const res = await api.post<{ booking: Booking }>(`/bookings/${id}/cancel`)
    return res.data
  },
}
