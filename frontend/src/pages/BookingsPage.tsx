import { useEffect, useState } from 'react'
import { bookingsApi, Booking } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function statusVariant(status: Booking['status']): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'PENDING') return 'warning'
  if (status === 'FAILED') return 'destructive'
  return 'secondary'
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
      <h1 className="mb-1 text-3xl font-black tracking-tight">My Bookings</h1>
      <p className="mb-6 text-sm text-muted-foreground">All booking states from the booking service.</p>

      {loading ? <p className="text-sm text-muted-foreground">Loading bookings...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-lg">Booking {booking.id}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Created {formatDateTime(booking.createdAt)}</p>
              </div>
              <Badge variant={statusVariant(booking.status)}>{booking.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
              <div>Event: {booking.eventName}</div>
              <div>Seats: {booking.seatIds.length}</div>
              <div className="font-semibold text-primary">{formatCurrency(booking.totalAmount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && bookings.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">You do not have any bookings yet.</p>
      ) : null}
    </main>
  )
}
