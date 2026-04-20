import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { bookingsApi, Event, eventsApi, inventoryApi, pollBookingStatus, Seat } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BookingPhase = 'idle' | 'submitting' | 'polling' | 'done'

const SECTION_ORDER = ['VIP', 'FLOOR', 'BALCONY', 'GENERAL']
const SECTION_LABELS: Record<string, string> = {
  VIP: 'VIP',
  FLOOR: 'Floor',
  BALCONY: 'Balcony',
  GENERAL: 'General',
}
const SECTION_COLORS: Record<string, string> = {
  VIP: 'bg-amber-50 border-amber-200',
  FLOOR: 'bg-blue-50 border-blue-200',
  BALCONY: 'bg-purple-50 border-purple-200',
  GENERAL: 'bg-gray-50 border-gray-200',
}

function groupBySection(seats: Seat[]): Map<string, Map<string, Seat[]>> {
  const sections = new Map<string, Map<string, Seat[]>>()
  for (const seat of seats) {
    const section = seat.section ?? 'GENERAL'
    if (!sections.has(section)) sections.set(section, new Map())
    const rows = sections.get(section)!
    if (!rows.has(seat.row)) rows.set(seat.row, [])
    rows.get(seat.row)!.push(seat)
  }
  // Sort seats within each row numerically
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
  let cls =
    'w-8 h-8 rounded-t-full border text-[10px] font-bold transition-all duration-100 flex items-center justify-center '

  if (seat.status === 'RESERVED' || seat.status === 'LOCKED') {
    cls += 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed opacity-70'
  } else if (isSelected) {
    cls += 'bg-primary border-primary text-primary-foreground scale-110 shadow-md cursor-pointer'
  } else if (disabled) {
    cls += 'bg-muted border-border text-muted-foreground cursor-not-allowed'
  } else {
    cls += 'bg-emerald-400 border-emerald-500 text-emerald-900 hover:bg-emerald-300 hover:scale-110 cursor-pointer'
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

export function EventPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

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
    if (!id || selected.length === 0) return

    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/events/${id}` } })
      return
    }

    setPhase('submitting')
    setError(null)

    try {
      const { id: bookingId } = await bookingsApi.create({ eventId: id, eventName: event.name, seatIds: selected, totalAmount: total })
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
    if (phase === 'polling') return 'Confirming...'
    return 'Confirm Booking'
  }

  const busy = phase === 'submitting' || phase === 'polling'

  if (loading) {
    return <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">Loading event...</main>
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <p className="mb-3 text-destructive">Event not found.</p>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          Back to events
        </Link>
      </main>
    )
  }

  const sortedSections = [...grouped.keys()].sort(
    (a, b) => (SECTION_ORDER.indexOf(a) === -1 ? 99 : SECTION_ORDER.indexOf(a)) -
               (SECTION_ORDER.indexOf(b) === -1 ? 99 : SECTION_ORDER.indexOf(b))
  )

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1.25fr_0.75fr] md:px-6">
      <section className="space-y-6">
        {/* Event header */}
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">{event.name}</h1>
          <p className="mt-2 text-muted-foreground">{event.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{formatDateTime(event.date)}</Badge>
            <Badge variant="outline">{event.venue?.name ?? 'Venue TBA'}</Badge>
            <Badge variant="outline">{availableSeats.length} available seats</Badge>
          </div>
        </div>

        {/* Seat map */}
        <Card>
          <CardHeader>
            <CardTitle>Select Seats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {seats.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No seats available for this event.</p>
            ) : (
              <>
                {/* Stage indicator */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2/3 rounded-lg bg-gradient-to-b from-gray-700 to-gray-900 py-3 text-center text-sm font-bold tracking-widest text-white shadow-lg">
                    STAGE
                  </div>
                  <div className="h-4 w-2/3 bg-gradient-to-b from-gray-900/20 to-transparent" />
                </div>

                {/* Sections */}
                {sortedSections.map((section) => {
                  const rows = grouped.get(section)!
                  const sectionColor = SECTION_COLORS[section] ?? 'bg-gray-50 border-gray-200'
                  const sectionLabel = SECTION_LABELS[section] ?? section

                  return (
                    <div key={section} className={`rounded-xl border-2 p-4 ${sectionColor}`}>
                      <div className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {sectionLabel}
                      </div>
                      <div className="space-y-2">
                        {[...rows.entries()].map(([row, rowSeats]) => (
                          <div key={row} className="flex items-center gap-2">
                            <span className="w-5 text-right text-xs font-bold text-muted-foreground">{row}</span>
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
                            <span className="w-5 text-left text-xs font-bold text-muted-foreground">{row}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-4 pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-t-full bg-emerald-400 border border-emerald-500" />
                    Available
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-t-full bg-primary border border-primary" />
                    Selected
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-t-full bg-gray-300 border border-gray-400" />
                    Taken
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Booking sidebar */}
      <aside>
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selected.length} seat{selected.length !== 1 ? 's' : ''}</span>
            </div>
            {selectedSeatLabels && (
              <div className="text-xs text-muted-foreground break-words">
                {selectedSeatLabels}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Price per seat: <span className="font-medium text-foreground">{formatCurrency(event.price)}</span>
            </div>
            <div className="border-t pt-3 text-lg font-semibold text-primary">
              Total: {formatCurrency(total)}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {phase === 'polling' && (
              <p className="text-sm text-muted-foreground">Processing payment — this may take a moment...</p>
            )}
            <Button className="w-full" disabled={selected.length === 0 || busy} onClick={createBooking}>
              {submitLabel()}
            </Button>
            {!isAuthenticated && selected.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">You'll be asked to log in to confirm.</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </main>
  )
}
