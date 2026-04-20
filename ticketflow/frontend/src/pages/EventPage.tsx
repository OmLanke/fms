import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { bookingsApi, Event, eventsApi, inventoryApi, pollBookingStatus, Seat } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BookingPhase = 'idle' | 'submitting' | 'polling' | 'done'

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
        setEvent(eventData.event)
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
      // POST /bookings → 202 Accepted
      const { bookingId } = await bookingsApi.create({ eventId: id, seatIds: selected })

      // Poll until booking leaves PENDING state
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

  if (loading) {
    return <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">Loading event...</main>
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <p className="mb-3 text-destructive">Event not found.</p>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">Back to events</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1.25fr_0.75fr] md:px-6">
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">{event.name}</h1>
          <p className="mt-2 text-muted-foreground">{event.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{formatDateTime(event.date)}</Badge>
            <Badge variant="outline">{event.venue?.name ?? 'Venue TBA'}</Badge>
            <Badge variant="outline">{availableSeats.length} available seats</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Seats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 md:grid-cols-10">
            {seats.map((seat) => {
              const isSelected = selected.includes(seat.id)
              const disabled = seat.status !== 'AVAILABLE' || busy

  const busy = phase === 'submitting' || phase === 'polling'

  return (
                <button
                  key={seat.id}
                  type="button"
                  onClick={() => toggleSeat(seat.id)}
                  disabled={disabled}
                  className={[
                    'rounded-md border px-2 py-2 text-xs font-medium transition',
                    disabled ? 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60' : '',
                    !disabled && isSelected ? 'border-primary bg-primary text-primary-foreground' : '',
                    !disabled && !isSelected ? 'border-border bg-background hover:border-primary/60' : '',
                  ].join(' ')}
                >
                  {seat.row}{seat.seatNumber}
                </button>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <aside>
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Selected seats: {selected.length}</div>
            <div className="text-sm text-muted-foreground">Price per seat: {formatCurrency(event.price)}</div>
            <div className="text-lg font-semibold text-primary">Total: {formatCurrency(total)}</div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {phase === 'polling' && (
              <p className="text-sm text-muted-foreground">Processing payment — this may take a moment...</p>
            )}
            <Button className="w-full" disabled={selected.length === 0 || busy} onClick={createBooking}>
              {submitLabel()}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </main>
  )
}
