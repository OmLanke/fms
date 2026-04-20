import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { CalendarDays, MapPin, Ticket } from 'lucide-react'
import { Event, eventsApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function LandingPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const cardsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await eventsApi.getAll()
        setEvents(data.events)
      } catch {
        setError('Could not load events. Ensure gateway is running on port 3000.')
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => setError('Unexpected error while loading events.'))
  }, [])

  useEffect(() => {
    if (!heroRef.current) return

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline
      .fromTo(heroRef.current.querySelectorAll('.hero-item'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.8 })
      .fromTo(cardsRef.current?.querySelectorAll('.event-card') ?? [], { opacity: 0, y: 28 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.6 }, '-=0.35')

    return () => {
      timeline.kill()
    }
  }, [events.length])

  const featured = useMemo(() => events.slice(0, 6), [events])

  return (
    <main>
      <section className="relative isolate overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(23,130,160,0.22),transparent_42%),radial-gradient(circle_at_85%_30%,rgba(232,119,40,0.26),transparent_40%),linear-gradient(140deg,#fff4e6_0%,#f0fbff_60%,#f9fafb_100%)]" />
        <div ref={heroRef} className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-16 md:px-6 md:py-20">
          <Badge variant="outline" className="hero-item w-fit border-primary/30 bg-white/70 text-primary">Distributed Ticketing Platform</Badge>
          <h1 className="hero-item max-w-4xl font-black leading-tight tracking-tight text-4xl md:text-6xl">
            Book Live Experiences Without Seat Collisions
          </h1>
          <p className="hero-item max-w-3xl text-base text-muted-foreground md:text-lg">
            TicketFlow uses microservices, Redis atomic locking, and async notifications to provide safe and fast seat booking under high concurrency.
          </p>
          <div className="hero-item flex gap-3">
            <a href="#events"><Button size="lg">Explore Events</Button></a>
            <Link to="/auth"><Button size="lg" variant="outline">Sign In To Book</Button></Link>
          </div>
        </div>
      </section>

      <section id="events" className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Upcoming Events</h2>
            <p className="text-sm text-muted-foreground">Real events from the event service, routed through the gateway.</p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <Ticket className="h-4 w-4" /> {events.length} listed
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading events...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div ref={cardsRef} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((event) => (
            <Card key={event.id} className="event-card border-border/70 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="line-clamp-1 text-xl">{event.name}</CardTitle>
                <CardDescription className="line-clamp-2">{event.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>{formatDateTime(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{event.venue?.name ?? 'Venue TBA'}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="text-lg font-semibold text-primary">{formatCurrency(event.price)}</div>
                  <Link to={`/events/${event.id}`}>
                    <Button size="sm">View Seats</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
