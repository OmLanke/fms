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
      return {
        label: 'Confirmed',
        dotClass: 'confirmed',
        textClass: 'text-[#2D9B5A]',
        borderClass: 'border-[#2D9B5A]',
      }
    case 'PENDING':
      return {
        label: 'Pending',
        dotClass: 'pending',
        textClass: 'text-[#C8860A]',
        borderClass: 'border-[#C8860A]',
      }
    case 'FAILED':
      return {
        label: 'Failed',
        dotClass: 'failed',
        textClass: 'text-red-500',
        borderClass: 'border-red-500',
      }
    default:
      return {
        label: 'Cancelled',
        dotClass: 'cancelled',
        textClass: 'text-muted-foreground',
        borderClass: 'border-muted-foreground',
      }
  }
}

async function buildSeatLabelsByBooking(bookings: Booking[]): Promise<Record<string, string[]>> {
  const uniqueEventIds = [...new Set(bookings.map((booking) => booking.eventId))]
  const seatsByEvent = new Map<string, Map<string, string>>()

  await Promise.all(
    uniqueEventIds.map(async (eventId) => {
      const { seats } = await inventoryApi.getSeats(eventId)
      const labelBySeatId = new Map<string, string>()
      for (const seat of seats) {
        labelBySeatId.set(seat.id, `${seat.row}${seat.seatNumber}`)
      }
      seatsByEvent.set(eventId, labelBySeatId)
    })
  )

  return bookings.reduce<Record<string, string[]>>((acc, booking) => {
    const labelBySeatId = seatsByEvent.get(booking.eventId)
    acc[booking.id] = booking.seatIds.map((seatId) => labelBySeatId?.get(seatId) ?? seatId)
    return acc
  }, {})
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [seatLabelsByBooking, setSeatLabelsByBooking] = useState<Record<string, string[]>>({})
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
          // Fallback to IDs if seat metadata can't be loaded.
          setSeatLabelsByBooking(
            bookingList.reduce<Record<string, string[]>>((acc, booking) => {
              acc[booking.id] = booking.seatIds
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
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.08, duration: 0.7 }
    )

    if (listRef.current) {
      const cards = listRef.current.querySelectorAll('.booking-card')
      if (cards.length > 0) {
        tl.fromTo(
          cards,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, stagger: 0.06, duration: 0.55 },
          '-=0.3'
        )
      }
    }

    return () => { tl.kill() }
  }, [loading])

  const confirmed = bookings.filter(b => b.status === 'CONFIRMED').length
  const pending = bookings.filter(b => b.status === 'PENDING').length
  const totalSpent = bookings.filter(b => b.status === 'CONFIRMED').reduce((sum, b) => sum + b.totalAmount, 0)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono&family=DM+Serif+Display&display=swap');
        .font-serif-display { font-family: 'DM Serif Display', serif; }
        .font-mono-dm { font-family: 'DM Mono', monospace; }
        .font-sans-dm { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Page header */}
      <div ref={headerRef} className="mb-10">
        <div className="header-item flex items-center gap-2 mb-3">
          <p className="eyebrow font-mono-dm text-muted-foreground/60 uppercase tracking-widest">Your Account</p>
        </div>
        <h1 className="header-item font-serif-display text-4xl tracking-tight md:text-5xl">My Bookings</h1>
        <p className="header-item mt-2 font-sans-dm font-light text-muted-foreground">All booking states from the booking service.</p>

        {/* Stats bar */}
        {!loading && bookings.length > 0 && (
          <div className="header-item mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1.4fr]">
            <StatCard
              label="Total Bookings"
              value={bookings.length}
              borderClass="border-neutral-500"
            />
            <StatCard
              label="Confirmed"
              value={confirmed}
              borderClass="border-[#2D9B5A]"
            />
            <StatCard
              label="Pending"
              value={pending}
              borderClass="border-[#C8860A]"
            />
            <StatCard
              label="Total Spent"
              value={formatCurrency(totalSpent)}
              borderClass="border-foreground"
            />
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground font-sans-dm">
          <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          Loading your bookings...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive font-sans-dm">
          {error}
        </div>
      )}

      {/* Booking list */}
      <div ref={listRef} className="space-y-4">
        {bookings.map((booking) => (
          <TicketModal key={booking.id} booking={booking}>
            <div>
              <BookingCard booking={booking} seatLabels={seatLabelsByBooking[booking.id] ?? booking.seatIds} />
            </div>
          </TicketModal>
        ))}
      </div>

      {/* Empty state */}
      {!loading && bookings.length === 0 && !error && (
        <div className="flex flex-col items-center gap-5 py-20 text-center font-sans-dm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/4">
            <Ticket className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1 font-serif-display">No bookings yet</h3>
            <p className="text-sm text-muted-foreground font-light">Browse events and grab your first seats.</p>
          </div>
          <Link to="/">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 gap-2 font-sans-dm">
              <Ticket className="h-4 w-4" />
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
  borderClass,
}: {
  label: string
  value: number | string
  borderClass: string
}) {
  return (
    <div className={`rounded-lg border-l-4 ${borderClass} bg-card p-4 transition-all hover:bg-card/50`}>
      <p className="font-mono-dm text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
      <p className="font-serif-display text-3xl font-medium mt-1">{value}</p>
    </div>
  )
}

function BookingCard({ booking, seatLabels }: { booking: Booking; seatLabels: string[] }) {
  const config = statusConfig(booking.status)
  const shortId = booking.id.split('-')[0].toUpperCase()

  return (
    <div className="booking-card group relative rounded-xl border border-white/8 bg-card overflow-hidden transition-all duration-200 hover:border-white/15 cursor-pointer">
      <div className="flex flex-col md:flex-row">
        {/* Main Body */}
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-mono-dm text-[10px] font-medium text-muted-foreground/50 uppercase">Booking</span>
            <span className="font-mono-dm text-xs font-bold text-foreground/70">#{shortId}</span>
          </div>

          <h3 className="font-serif-display text-[26px] leading-tight text-foreground">{booking.eventName}</h3>

          <div className="font-mono-dm text-xs text-muted-foreground">
            {formatDateTime(booking.createdAt)}
          </div>

          <div className="pt-3 border-t border-white/6 flex items-center justify-between font-sans-dm">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ticket className="h-3.5 w-3.5 opacity-50" />
                <span>
                  <span className="font-medium text-foreground">{seatLabels.length}</span> seats
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {seatLabels.map((seatLabel, index) => (
                  <span key={`${booking.id}-${seatLabel}-${index}`} className="text-[9px] font-mono-dm px-1 border border-white/10 bg-white/5 rounded text-foreground/60">
                    {seatLabel}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-sm font-medium text-foreground">
              {formatCurrency(booking.totalAmount)}
            </div>
          </div>
        </div>

        {/* Ticket Stub */}
        <div className="md:w-[120px] bg-white/[0.02] border-t md:border-t-0 md:border-l border-dashed border-white/15 p-4 flex flex-col items-center justify-center gap-4 relative">
          <div className="text-center space-y-1">
            <p className="font-mono-dm text-[9px] font-bold text-muted-foreground/40 uppercase">Ref</p>
            <p className="font-mono-dm text-xs font-bold text-foreground/60">{shortId}</p>
          </div>

          {/* Decorative Barcode */}
          <div className="flex items-end justify-center gap-0.5 h-8 w-full opacity-40">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="bg-foreground w-[1px] md:w-[2px]"
                style={{ height: `${Math.floor(Math.random() * 100) + 20}%` }}
              />
            ))}
          </div>

          <Link to={`/bookings/${booking.id}`} className="text-[10px] font-mono-dm font-bold uppercase tracking-tighter text-primary hover:text-primary/80 transition-colors">
            View ticket
          </Link>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`absolute top-6 right-6 flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold font-mono-dm ${config.borderClass} ${config.textClass} bg-transparent`}>
        <span className={`status-dot ${config.dotClass} h-1.5 w-1.5 rounded-full`} />
        {config.label}
      </div>
    </div>
  )
}