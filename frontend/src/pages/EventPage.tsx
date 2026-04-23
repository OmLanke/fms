import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { bookingsApi, BookingStatusTimeoutError, Event, eventsApi, inventoryApi, paymentsApi, pollBookingStatus, Seat } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CalendarDays, MapPin, Ticket, Users, ChevronLeft, Loader2 } from 'lucide-react'

type BookingPhase = 'idle' | 'submitting' | 'checkout' | 'polling' | 'done'

const SECTION_ORDER = ['VIP', 'FLOOR', 'BALCONY', 'GENERAL']
const SECTION_LABELS: Record<string, string> = {
  VIP: 'VIP',
  FLOOR: 'Floor',
  BALCONY: 'Balcony',
  GENERAL: 'General Admission',
}
const SECTION_STYLES: Record<string, { bg: string; border: string; label: string; accent: string }> = {
  VIP: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    label: 'text-amber-400',
    accent: 'bg-amber-400',
  },
  FLOOR: {
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    label: 'text-primary',
    accent: 'bg-primary',
  },
  BALCONY: {
    bg: 'bg-violet-500/5',
    border: 'border-violet-500/20',
    label: 'text-violet-400',
    accent: 'bg-violet-400',
  },
  GENERAL: {
    bg: 'bg-white/3',
    border: 'border-white/10',
    label: 'text-muted-foreground',
    accent: 'bg-muted-foreground',
  },
}

function groupBySection(seats: Seat[]): Map<string, Map<string, Seat[]>> {
  const sections = new Map<string, Map<string, Seat[]>>()
  for (const seat of seats) {
    const section = (seat as Seat & { section?: string }).section ?? 'GENERAL'
    if (!sections.has(section)) sections.set(section, new Map())
    const rows = sections.get(section)!
    if (!rows.has(seat.row)) rows.set(seat.row, [])
    rows.get(seat.row)!.push(seat)
  }
  for (const rows of sections.values()) {
    for (const [row, rowSeats] of rows) {
      rows.set(row, rowSeats.sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber)))
    }
  }
  return sections
}

function SeatButton({
  seat,
  isSelected,
  disabled,
  onToggle,
}: {
  seat: Seat
  isSelected: boolean
  disabled: boolean
  onToggle: (id: string) => void
}) {
  const isTaken = seat.status === 'RESERVED' || seat.status === 'LOCKED'

  let cls = 'w-8 h-8 rounded-t-full border text-[9px] font-bold transition-all duration-150 flex items-center justify-center '

  if (isTaken) {
    cls += 'bg-white/5 border-white/10 text-muted-foreground/40 cursor-not-allowed'
  } else if (isSelected) {
    cls += 'bg-primary border-primary text-primary-foreground scale-110 shadow-[0_0_12px_rgba(34,211,238,0.4)] cursor-pointer'
  } else if (disabled) {
    cls += 'bg-white/5 border-white/8 text-muted-foreground/40 cursor-not-allowed'
  } else {
    cls += 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400/60 hover:scale-110 cursor-pointer'
  }

  return (
    <button
      type="button"
      title={`${seat.row}${seat.seatNumber} — ${seat.status}`}
      disabled={disabled || seat.status !== 'AVAILABLE'}
      onClick={() => onToggle(seat.id)}
      className={cls}
    >
      {seat.seatNumber}
    </button>
  )
}

type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

type RazorpayCheckoutResult =
  | { status: 'success'; response: RazorpaySuccessResponse }
  | { status: 'dismissed' }
  | { status: 'failed'; message: string }

let razorpayScriptPromise: Promise<void> | null = null

function loadRazorpayScript(): Promise<void> {
  if ((window as Window & { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve()
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise
  }

  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById('razorpay-checkout-script') as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout script.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'razorpay-checkout-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout script.'))
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}

function getPaymentFailedMessage(payload: unknown): string {
  const response = payload as { error?: { description?: string } }
  return response.error?.description ?? 'Payment failed. Please try again.'
}

function openRazorpayCheckout(args: {
  key: string
  orderId: string
  amount: number
  currency: string
  eventName: string
  userEmail?: string
}): Promise<RazorpayCheckoutResult> {
  return new Promise((resolve, reject) => {
    const RazorpayConstructor = (window as Window & {
      Razorpay?: new (options: Record<string, unknown>) => {
        open: () => void
        on?: (event: string, handler: (payload: unknown) => void) => void
      }
    }).Razorpay

    if (!RazorpayConstructor) {
      reject(new Error('Razorpay checkout is not available.'))
      return
    }

    let settled = false
    const settle = (result: RazorpayCheckoutResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const checkout = new RazorpayConstructor({
      key: args.key,
      amount: args.amount,
      currency: args.currency,
      order_id: args.orderId,
      name: 'TicketFlow',
      description: `Booking for ${args.eventName}`,
      prefill: {
        email: args.userEmail,
      },
      theme: {
        color: '#06b6d4',
      },
      handler: (response: RazorpaySuccessResponse) => {
        settle({ status: 'success', response })
      },
      modal: {
        ondismiss: () => {
          settle({ status: 'dismissed' })
        },
      },
    })

    checkout.on?.('payment.failed', (payload: unknown) => {
      settle({ status: 'failed', message: getPaymentFailedMessage(payload) })
    })

    checkout.open()
  })
}

export function EventPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const [event, setEvent] = useState<Event | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<BookingPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const [eventData, seatData] = await Promise.all([eventsApi.getById(id), inventoryApi.getSeats(id)])
        setEvent(eventData)
        setSeats(seatData.seats)
      } catch {
        setError('Unable to load event details.')
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => setError('Unexpected error while loading event.'))
  }, [id])

  const availableSeats = useMemo(() => seats.filter((seat) => seat.status === 'AVAILABLE'), [seats])
  const total = useMemo(() => (event ? event.price * selected.length : 0), [event, selected.length])
  const grouped = useMemo(() => groupBySection(seats), [seats])
  const selectedSeatLabels = useMemo(
    () =>
      seats
        .filter((s) => selected.includes(s.id))
        .map((s) => `${s.row}${s.seatNumber}`)
        .join(', '),
    [seats, selected]
  )

  const toggleSeat = (seatId: string) => {
    setSelected((current) =>
      current.includes(seatId) ? current.filter((idValue) => idValue !== seatId) : [...current, seatId]
    )
  }

  const createBooking = async () => {
    if (!id || selected.length === 0 || !event) return

    if (!isAuthenticated || !user) {
      navigate('/auth', { state: { from: `/events/${id}` } })
      return
    }

    setPhase('submitting')
    setError(null)

    try {
      const { id: bookingId } = await bookingsApi.create({ eventId: id, eventName: event.name, seatIds: selected, totalAmount: total })

      await loadRazorpayScript()

      const order = await paymentsApi.createOrder({
        booking_id: bookingId,
        user_id: user.id,
        amount: total,
        currency: 'INR',
      })

      setPhase('checkout')
      const checkoutResult = await openRazorpayCheckout({
        key: order.razorpay_key_id,
        orderId: order.order_id,
        amount: order.amount,
        currency: order.currency,
        eventName: event.name,
        userEmail: user.email,
      })

      if (checkoutResult.status === 'dismissed') {
        await bookingsApi.cancel(bookingId).catch(() => undefined)
        setPhase('idle')
        setError('Payment was cancelled. Your booking has been cancelled.')
        return
      }

      if (checkoutResult.status === 'failed') {
        await bookingsApi.cancel(bookingId).catch(() => undefined)
        setPhase('idle')
        setError(checkoutResult.message)
        return
      }

      const verification = await paymentsApi.verify({
        payment_id: order.payment_id,
        razorpay_order_id: checkoutResult.response.razorpay_order_id,
        razorpay_payment_id: checkoutResult.response.razorpay_payment_id,
        signature: checkoutResult.response.razorpay_signature,
      })

      if (verification.status !== 'SUCCESS') {
        setPhase('idle')
        setError('Payment verification failed. Please try again.')
        return
      }

      setPhase('polling')
      const booking = await pollBookingStatus(bookingId)

      if (booking.status === 'CONFIRMED') {
        setPhase('done')
        navigate('/bookings')
      } else {
        setPhase('idle')
        setError('Booking could not be confirmed. The seats may have been taken or payment failed.')
      }
    } catch (err: unknown) {
      if (err instanceof BookingStatusTimeoutError) {
        setPhase('done')
        navigate('/bookings', {
          state: {
            notice: 'Booking is still processing. This can take a bit longer under load, so check the latest status here in My Bookings.',
          },
        })
        return
      }

      setPhase('idle')
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Booking failed. Please try again.')
      }
    }
  }

  const submitLabel = () => {
    if (phase === 'submitting') return 'Placing order...'
    if (phase === 'checkout') return 'Awaiting payment...'
    if (phase === 'polling') return 'Confirming...'
    return 'Confirm Booking'
  }

  const busy = phase === 'submitting' || phase === 'checkout' || phase === 'polling'

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-20 md:px-6 flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        Loading event...
      </main>
    )
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive mb-4">
          Event not found.
        </div>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          Back to events
        </Link>
      </main>
    )
  }

  const sortedSections = [...grouped.keys()].sort(
    (a, b) =>
      (SECTION_ORDER.indexOf(a) === -1 ? 99 : SECTION_ORDER.indexOf(a)) -
      (SECTION_ORDER.indexOf(b) === -1 ? 99 : SECTION_ORDER.indexOf(b))
  )

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1.3fr_0.7fr] md:px-6">
      <section className="space-y-6 min-w-0">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          All Events
        </Link>

        {/* Event header */}
        <div>
          <h1 className="text-3xl font-black tracking-[-0.025em] md:text-4xl leading-tight">{event.name}</h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">{event.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-primary/50" />
              {formatDateTime(event.date)}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary/50" />
              {event.venue?.name ?? 'Venue TBA'}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-xs text-emerald-400">
              <Users className="h-3.5 w-3.5" />
              {availableSeats.length} seats available
            </div>
          </div>
        </div>

        {/* Seat map */}
        <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
          <div className="border-b border-white/6 px-5 py-4">
            <h2 className="text-base font-bold">Select Seats</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click available seats to select them</p>
          </div>

          <div className="p-5 space-y-5">
            {seats.length === 0 ? (
              <div className="py-12 text-center">
                <Ticket className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No seats available for this event.</p>
              </div>
            ) : (
              <>
                {/* Stage */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-3/5 rounded-xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 py-3 text-center text-xs font-bold tracking-[0.3em] text-muted-foreground/70 uppercase shadow-inner">
                    STAGE
                  </div>
                  <div className="h-5 w-3/5 bg-gradient-to-b from-white/5 to-transparent rounded-b-2xl" />
                </div>

                {/* Sections */}
                {sortedSections.map((section) => {
                  const rows = grouped.get(section)!
                  const style = SECTION_STYLES[section] ?? SECTION_STYLES.GENERAL
                  const label = SECTION_LABELS[section] ?? section

                  return (
                    <div key={section} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                      <div className={`mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${style.label}`}>
                        <div className={`h-1 w-8 rounded-full ${style.accent} opacity-60`} />
                        {label}
                        <div className={`h-1 w-8 rounded-full ${style.accent} opacity-60`} />
                      </div>
                      <div className="space-y-2">
                        {[...rows.entries()].map(([row, rowSeats]) => (
                          <div key={row} className="flex items-center gap-2">
                            <span className="w-5 text-right text-[10px] font-bold text-muted-foreground/50">{row}</span>
                            <div className="flex flex-1 flex-wrap justify-center gap-1">
                              {rowSeats.map((seat) => (
                                <SeatButton
                                  key={seat.id}
                                  seat={seat}
                                  isSelected={selected.includes(seat.id)}
                                  disabled={busy}
                                  onToggle={toggleSeat}
                                />
                              ))}
                            </div>
                            <span className="w-5 text-left text-[10px] font-bold text-muted-foreground/50">{row}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-5 pt-1 text-xs text-muted-foreground/60">
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-t-full bg-emerald-500/20 border border-emerald-500/40" />
                    Available
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-t-full bg-primary border border-primary shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                    Selected
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-t-full bg-white/5 border border-white/10" />
                    Taken
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Booking sidebar */}
      <aside>
        <div className="sticky top-24 rounded-2xl border border-white/8 bg-card overflow-hidden">
          {/* Header */}
          <div className="border-b border-white/6 px-5 py-4">
            <h2 className="text-base font-bold">Booking Summary</h2>
          </div>

          <div className="p-5 space-y-4">
            {/* Selected count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Seats selected</span>
              <span className="font-bold tabular-nums">
                {selected.length === 0 ? (
                  <span className="text-muted-foreground/60">None</span>
                ) : (
                  <span className="text-foreground">{selected.length}</span>
                )}
              </span>
            </div>

            {/* Seat labels */}
            {selectedSeatLabels && (
              <div className="rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-xs font-mono text-muted-foreground/80 break-words leading-relaxed">
                {selectedSeatLabels}
              </div>
            )}

            {/* Price per seat */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per seat</span>
              <span className="font-semibold">{formatCurrency(event.price)}</span>
            </div>

            {/* Divider */}
            <div className="border-t border-white/8" />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-black text-gradient">{formatCurrency(total)}</span>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive leading-relaxed">
                {error}
              </div>
            )}

            {/* Polling status */}
            {phase === 'polling' && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                Finalizing your booking — this may take a moment...
              </div>
            )}

            {phase === 'checkout' && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-3 py-2.5 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                Complete payment in the Razorpay checkout window...
              </div>
            )}

            {/* CTA Button */}
            <Button
              className="w-full font-bold gap-2"
              size="lg"
              disabled={selected.length === 0 || busy}
              onClick={createBooking}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel()}
            </Button>

            {!isAuthenticated && selected.length > 0 && (
              <p className="text-center text-xs text-muted-foreground/60">
                You'll be asked to log in to confirm.
              </p>
            )}
          </div>
        </div>
      </aside>
    </main>
  )
}
