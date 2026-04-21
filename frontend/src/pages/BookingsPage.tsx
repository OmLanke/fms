import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { bookingsApi, Booking } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Ticket, CheckCircle2, Clock, XCircle, Ban, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TicketModal } from '@/components/TicketModal'

function statusConfig(status: Booking['status']) {
  switch (status) {
    case 'CONFIRMED':
      return {
        label: 'Confirmed',
        dotClass: 'confirmed',
        textClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        icon: CheckCircle2,
        iconClass: 'text-emerald-400',
      }
    case 'PENDING':
      return {
        label: 'Pending',
        dotClass: 'pending',
        textClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10 border-amber-500/20',
        icon: Clock,
        iconClass: 'text-amber-400',
      }
    case 'FAILED':
      return {
        label: 'Failed',
        dotClass: 'failed',
        textClass: 'text-red-400',
        bgClass: 'bg-red-500/10 border-red-500/20',
        icon: XCircle,
        iconClass: 'text-red-400',
      }
    default:
      return {
        label: 'Cancelled',
        dotClass: 'cancelled',
        textClass: 'text-muted-foreground',
        bgClass: 'bg-white/5 border-white/10',
        icon: Ban,
        iconClass: 'text-muted-foreground',
      }
  }
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await bookingsApi.getMyBookings()
        setBookings(Array.isArray(data) ? data : (data.bookings ?? []))
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
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6">
      {/* Page header */}
      <div ref={headerRef} className="mb-10">
        <div className="header-item flex items-center gap-2 mb-3">
          <p className="eyebrow text-primary/60">Your Account</p>
        </div>
        <h1 className="header-item text-4xl font-black tracking-[-0.03em] md:text-5xl">My Bookings</h1>
        <p className="header-item mt-2 text-muted-foreground">All booking states from the booking service.</p>

        {/* Stats bar */}
        {!loading && bookings.length > 0 && (
          <div className="header-item mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total Bookings"
              value={bookings.length}
              icon={Ticket}
              iconClass="text-primary/60"
              valueClass="text-foreground"
            />
            <StatCard
              label="Confirmed"
              value={confirmed}
              icon={CheckCircle2}
              iconClass="text-emerald-400"
              valueClass="text-emerald-400"
            />
            <StatCard
              label="Pending"
              value={pending}
              icon={Clock}
              iconClass="text-amber-400"
              valueClass="text-amber-400"
            />
            <StatCard label="Total Spent" value={formatCurrency(totalSpent)} icon={TrendingUp} iconClass="text-primary/60" valueClass="text-gradient" />
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
          <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          Loading your bookings...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Booking list */}
      <div ref={listRef} className="space-y-3">
        {bookings.map((booking) => (
          <TicketModal key={booking.id} booking={booking}>
            <div>
              <BookingCard booking={booking} />
            </div>
          </TicketModal>
        ))}
      </div>

      {/* Empty state */}
      {!loading && bookings.length === 0 && !error && (
        <div className="flex flex-col items-center gap-5 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/4">
            <Ticket className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1">No bookings yet</h3>
            <p className="text-sm text-muted-foreground">Browse events and grab your first seats.</p>
          </div>
          <Link to="/">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 gap-2">
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
  icon: Icon,
  iconClass,
  valueClass,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  iconClass: string
  valueClass: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      <p className={`text-2xl font-black tracking-tight ${valueClass}`}>{value}</p>
    </div>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  const config = statusConfig(booking.status)
  const Icon = config.icon
  const shortId = booking.id.split('-')[0].toUpperCase()

  return (
    <div className="booking-card group relative rounded-2xl border border-white/8 bg-card overflow-hidden transition-all duration-200 hover:border-white/15 hover:bg-card/80 cursor-pointer hover:shadow-[0_4px_24px_rgba(34,211,238,0.06)]">
      {/* Ticket-style layout */}
      <div className="flex">
        {/* Left content */}
        <div className="flex-1 p-5 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase">Booking</span>
                <span className="font-mono text-xs font-bold text-primary/70">#{shortId}</span>
              </div>
              <h3 className="text-base font-bold tracking-tight">{booking.eventName}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(booking.createdAt)}</p>
            </div>

            {/* Status badge */}
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${config.bgClass} ${config.textClass} shrink-0`}>
              <span className={`status-dot ${config.dotClass}`} />
              {config.label}
            </div>
          </div>

          {/* Details row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Ticket className="h-3.5 w-3.5 text-primary/40" />
              <span>
                <span className="font-semibold text-foreground">{booking.seatIds.length}</span>{' '}
                seat{booking.seatIds.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${config.iconClass}`} />
              <span className={`font-black text-lg tracking-tight ${config.textClass}`}>
                {formatCurrency(booking.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Right divider + ID panel */}
        <div className="hidden md:flex flex-col items-center justify-center border-l border-dashed border-white/10 px-5 min-w-[110px] relative gap-3">
          {/* Notch cutouts */}
          <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-white/8" />
          <div className="text-center space-y-1">
            <p className="eyebrow text-muted-foreground/40">Ref</p>
            <p className="font-mono text-xs font-bold text-muted-foreground/60 break-all">{shortId}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-primary/50 group-hover:text-primary/80 transition-colors">
            <Ticket className="h-3 w-3" />
            View ticket
          </div>
        </div>
      </div>
    </div>
  )
}
