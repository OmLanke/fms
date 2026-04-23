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

  let cls =
    'w-8 h-8 border text-[9px] font-bold font-mono transition-all duration-100 flex items-center justify-center shrink-0 rounded-md '

  if (isTaken) {
    cls += 'bg-muted border-border text-muted-foreground/30 cursor-not-allowed'
  } else if (isSelected) {
    cls += 'bg-foreground border-foreground text-background cursor-pointer'
  } else if (disabled) {
    cls += 'bg-muted border-border text-muted-foreground/30 cursor-not-allowed'
  } else {
    cls +=
      'bg-background border-border text-muted-foreground hover:bg-foreground hover:border-foreground hover:text-background cursor-pointer'
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
        const [eventData, seatData] = await Promise.all([
          eventsApi.getById(id),
          inventoryApi.getSeats(id),
        ])
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

  const availableSeats = useMemo(
    () => seats.filter((s) => s.status === 'AVAILABLE'),
    [seats]
  )
  const total = useMemo(
    () => (event ? event.price * selected.length : 0),
    [event, selected.length]
  )
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
    setSelected((curr) =>
      curr.includes(seatId) ? curr.filter((i) => i !== seatId) : [...curr, seatId]
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
      const { id: bookingId } = await bookingsApi.create({
        eventId: id,
        eventName: event.name,
        seatIds: selected,
        totalAmount: total,
      })

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
        setError(
          'Booking could not be confirmed. The seats may have been taken.'
        )
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
      setError(
        err instanceof Error ? err.message : 'Booking failed. Please try again.'
      )
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
      <main className="mx-auto max-w-7xl px-6 py-20 flex items-center gap-3 text-sm text-muted-foreground">
        <div className="spinner" />
        Loading event...
      </main>
    )
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-4">
          Event not found.
        </div>
        <Link to="/" className="text-xs font-semibold uppercase tracking-widest underline underline-offset-2">
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
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 md:grid-cols-[1fr_300px]">
      <section className="space-y-6 min-w-0">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          All Events
        </Link>

        {/* Event header */}
        <div className="pb-6 border-b border-border">
          <h1 className="font-sans font-semibold tracking-tight text-4xl md:text-5xl leading-[1.05] tracking-[-0.02em] mb-3">
            {event.name}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-5">
            {event.description}
          </p>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {formatDateTime(event.date)}
            </div>
            <div className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.venue?.name ?? 'Venue TBA'}
            </div>
            <div className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs text-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {availableSeats.length} available
            </div>
          </div>
        </div>

        {/* Seat map */}
        <div className="ring-1 ring-foreground/5 shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="eyebrow text-muted-foreground">Select Seats</p>
          </div>

          <div className="p-5 space-y-6">
            {seats.length === 0 ? (
              <div className="py-16 text-center">
                <div className="h-12 w-12 border border-border mx-auto mb-4 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No seats available for this event.
                </p>
              </div>
            ) : (
              <>
                {/* Stage indicator */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-1/2 border border-border bg-muted/50 py-2.5 text-center text-[9px] font-bold tracking-[0.35em] text-muted-foreground uppercase">
                    STAGE
                  </div>
                  <div className="w-1/2 h-3 bg-gradient-to-b from-muted/30 to-transparent" />
                </div>

                {/* Sections */}
                {sortedSections.map((section) => {
                  const rows = grouped.get(section)!
                  const label = SECTION_LABELS[section] ?? section
                  return (
                    <div key={section} className="border border-border">
                      <div className="border-b border-border px-4 py-2.5 flex items-center justify-center">
                        <span className="eyebrow text-muted-foreground">{label}</span>
                      </div>
                      <div className="p-4 space-y-2">
                        {[...rows.entries()].map(([row, rowSeats]) => (
                          <div key={row} className="flex items-center gap-2">
                            <span className="w-5 text-right text-[9px] font-bold font-mono text-muted-foreground/50 shrink-0">
                              {row}
                            </span>
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
                            <span className="w-5 text-left text-[9px] font-bold font-mono text-muted-foreground/50 shrink-0">
                              {row}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 border border-border bg-background" />
                    Available
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 border border-foreground bg-foreground" />
                    Selected
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 border border-border bg-muted" />
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
        <div className="sticky top-20 ring-1 ring-foreground/5 shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="eyebrow text-muted-foreground">Booking Summary</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Seats selected</span>
              <span className="font-bold font-mono">
                {selected.length === 0 ? (
                  <span className="text-muted-foreground font-normal">None</span>
                ) : (
                  selected.length
                )}
              </span>
            </div>

            {selectedSeatLabels && (
              <div className="border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground break-words leading-relaxed">
                {selectedSeatLabels}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per seat</span>
              <span className="font-semibold">{formatCurrency(event.price)}</span>
            </div>

            <div className="border-t border-border" />

            <div className="flex items-center justify-between">
              <span className="eyebrow text-muted-foreground">Total</span>
              <span className="font-sans font-semibold tracking-tight text-2xl">{formatCurrency(total)}</span>
            </div>

            {error && (
              <div className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive leading-relaxed">
                {error}
              </div>
            )}

            {phase === 'polling' && (
              <div className="flex items-center gap-2 border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
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

            <Button
              className="w-full gap-2"
              size="lg"
              disabled={selected.length === 0 || busy}
              onClick={createBooking}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitLabel()}
            </Button>

            {!isAuthenticated && selected.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                You'll be asked to sign in to confirm.
              </p>
            )}
          </div>
        </div>
      </aside>
    </main>
  )
}
