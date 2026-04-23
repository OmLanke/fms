import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { bookingsApi, Booking, inventoryApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TicketModal } from '@/components/TicketModal'

function statusConfig(status: Booking['status']) {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', dotClass: 'confirmed', textClass: 'text-[#16a34a]' }
    case 'PENDING':
      return { label: 'Pending', dotClass: 'pending', textClass: 'text-[#d97706]' }
    case 'FAILED':
      return { label: 'Failed', dotClass: 'failed', textClass: 'text-[#dc2626]' }
    default:
      return { label: 'Cancelled', dotClass: 'cancelled', textClass: 'text-muted-foreground' }
  }
}

async function buildSeatLabelsByBooking(
  bookings: Booking[]
): Promise<Record<string, string[]>> {
  const uniqueEventIds = [...new Set(bookings.map((b) => b.eventId))]
  const seatsByEvent = new Map<string, Map<string, string>>()
  await Promise.all(
    uniqueEventIds.map(async (eventId) => {
      const { seats } = await inventoryApi.getSeats(eventId)
      const map = new Map<string, string>()
      for (const seat of seats) {
        map.set(seat.id, `${seat.row}${seat.seatNumber}`)
      }
      seatsByEvent.set(eventId, map)
    })
  )
  return bookings.reduce<Record<string, string[]>>((acc, booking) => {
    const labelMap = seatsByEvent.get(booking.eventId)
    acc[booking.id] = booking.seatIds.map((sid) => labelMap?.get(sid) ?? sid)
    return acc
  }, {})
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [seatLabelsByBooking, setSeatLabelsByBooking] = useState<
    Record<string, string[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await bookingsApi.getMyBookings()
        const bookingList = Array.isArray(data) ? data : (data.bookings ?? [])
        setBookings(bookingList)
        if (bookingList.length === 0) {
          setSeatLabelsByBooking({})
          return
        }
        try {
          const labels = await buildSeatLabelsByBooking(bookingList)
          setSeatLabelsByBooking(labels)
        } catch {
          setSeatLabelsByBooking(
            bookingList.reduce<Record<string, string[]>>((acc, b) => {
              acc[b.id] = b.seatIds
              return acc
            }, {})
          )
        }
      } catch {
        setError('Unable to load your bookings right now.')
      } finally {
        setLoading(false)
      }
    }
    load().catch(() => setError('Unexpected error while loading bookings.'))
  }, [])

  useEffect(() => {
    if (loading || !headerRef.current) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(
      headerRef.current.querySelectorAll('.header-item'),
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, stagger: 0.07, duration: 0.65 }
    )
    if (listRef.current) {
      const cards = listRef.current.querySelectorAll('.booking-card')
      if (cards.length > 0) {
        tl.fromTo(
          cards,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.5 },
          '-=0.3'
        )
      }
    }
    return () => { tl.kill() }
  }, [loading])

  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED').length
  const pending = bookings.filter((b) => b.status === 'PENDING').length
  const totalSpent = bookings
    .filter((b) => b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + b.totalAmount, 0)

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      {/* Page header */}
      <div ref={headerRef} className="mb-12">
        <div className="header-item mb-4">
          <p className="eyebrow text-muted-foreground">Your Account</p>
        </div>
        <h1 className="header-item font-sans font-semibold tracking-tight text-5xl mb-2">My Bookings</h1>
        <p className="header-item text-sm text-muted-foreground">
          All booking states from the booking service.
        </p>

        {/* Stats */}
        {!loading && bookings.length > 0 && (
          <div className="header-item mt-10 grid grid-cols-2 md:grid-cols-4 ring-1 ring-foreground/5 shadow-sm">
            <StatCard label="Total" value={bookings.length} />
            <StatCard label="Confirmed" value={confirmed} accent="confirmed" />
            <StatCard label="Pending" value={pending} accent="pending" />
            <StatCard label="Total Spent" value={formatCurrency(totalSpent)} last />
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
          <div className="spinner" />
          Loading your bookings...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Booking list */}
      <div ref={listRef} className="ring-1 ring-foreground/5 shadow-sm">
        {bookings.map((booking, i) => (
          <TicketModal key={booking.id} booking={booking}>
            <div className={i < bookings.length - 1 ? 'border-b border-border' : ''}>
              <BookingCard
                booking={booking}
                seatLabels={seatLabelsByBooking[booking.id] ?? booking.seatIds}
              />
            </div>
          </TicketModal>
        ))}
      </div>

      {/* Empty state */}
      {!loading && bookings.length === 0 && !error && (
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <div className="h-14 w-14 border border-border flex items-center justify-center">
            <Ticket className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <div>
            <h3 className="font-sans font-semibold tracking-tight text-2xl mb-1.5">No bookings yet</h3>
            <p className="text-sm text-muted-foreground">
              Browse events and grab your first seats.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <Ticket className="h-3.5 w-3.5" />
              Browse Events
            </Button>
          </Link>
        </div>
      )}
    </main>
  )
}

function StatCard({
  label,
  value,
  accent,
  last,
}: {
  label: string
  value: number | string
  accent?: 'confirmed' | 'pending'
  last?: boolean
}) {
  const borderTop =
    accent === 'confirmed'
      ? 'border-t-2 border-t-[#16a34a]'
      : accent === 'pending'
      ? 'border-t-2 border-t-[#d97706]'
      : 'border-t-2 border-t-foreground/20'

  return (
    <div
      className={`p-5 ${borderTop} ${!last ? 'border-r border-border' : ''}`}
    >
      <p className="eyebrow text-muted-foreground mb-2">{label}</p>
      <p className="font-sans font-semibold tracking-tight text-3xl leading-none">{value}</p>
    </div>
  )
}

function BookingCard({
  booking,
  seatLabels,
}: {
  booking: Booking
  seatLabels: string[]
}) {
  const config = statusConfig(booking.status)
  const shortId = booking.id.split('-')[0].toUpperCase()

  return (
    <div className="booking-card group flex cursor-pointer hover:bg-muted/20 transition-colors">
      {/* Main body */}
      <div className="flex-1 p-6 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-muted-foreground/60">Booking</span>
            <span className="font-mono-dm text-xs font-medium text-foreground/70">
              #{shortId}
            </span>
          </div>
          <div
            className={`flex items-center gap-1.5 border border-current px-2 py-0.5 ${config.textClass}`}
          >
            <span className={`status-dot ${config.dotClass}`} />
            <span className="text-[10px] font-bold font-mono-dm tracking-wider">{config.label}</span>
          </div>
        </div>

        <h3 className="font-sans font-semibold tracking-tight text-2xl leading-tight mb-3">{booking.eventName}</h3>

        <p className="font-mono-dm text-[11px] text-muted-foreground mb-4">
          {formatDateTime(booking.createdAt)}
        </p>

        <div className="flex items-end justify-between pt-4 border-t border-border">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Ticket className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">{seatLabels.length}</span>{' '}
                {seatLabels.length === 1 ? 'seat' : 'seats'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {seatLabels.map((label, i) => (
                <span
                  key={`${booking.id}-${label}-${i}`}
                  className="text-[9px] font-mono-dm px-1.5 py-0.5 border border-border bg-muted/60 text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <span className="font-sans font-semibold tracking-tight text-xl">{formatCurrency(booking.totalAmount)}</span>
        </div>
      </div>

      {/* Ticket stub */}
      <div className="w-[80px] shrink-0 border-l border-dashed border-border flex flex-col items-center justify-center gap-4 p-3">
        <div className="text-center">
          <p className="eyebrow text-muted-foreground/40 mb-1">Ref</p>
          <p className="font-mono-dm text-xs font-bold text-foreground/60">{shortId}</p>
        </div>
        <div className="flex items-end justify-center gap-px h-8 w-full opacity-20">
          {[2, 4, 3, 5, 2, 4, 3, 5, 2, 3].map((h, i) => (
            <div
              key={i}
              className="bg-foreground w-[2px]"
              style={{ height: `${h * 20}%` }}
            />
          ))}
        </div>
        <span className="eyebrow text-muted-foreground/40 text-center">tap</span>
      </div>
    </div>
  )
}
