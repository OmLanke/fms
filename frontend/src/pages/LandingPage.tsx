import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { CalendarDays, MapPin, Ticket, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Event, eventsApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const eventImage = '/Rock_Night.jpg'

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
        setEvents(data.events ?? [])
      } catch {
        setError('Could not load events. Ensure the gateway is running.')
      } finally {
        setLoading(false)
      }
    }
    load().catch(() => setError('Unexpected error while loading events.'))
  }, [])

  useEffect(() => {
    if (!heroRef.current) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, stagger: 0.09, duration: 0.85 }
    )
    const cards = cardsRef.current?.querySelectorAll('.event-card')
    if (cards?.length) {
      tl.fromTo(
        cards,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.6 },
        '-=0.4'
      )
    }
    return () => { tl.kill() }
  }, [events.length])

  const featured = useMemo(() => events.slice(0, 6), [events])

  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border/50 dark:border-border">
        <div ref={heroRef} className="mx-auto flex flex-col items-center gap-2 px-6 py-8 text-center md:py-16 lg:py-20 xl:gap-4">
          <div className="hero-item mb-2 mt-4">
            <span className="eyebrow text-muted-foreground uppercase tracking-widest text-xs">Distributed Ticketing Platform</span>
          </div>

          <h1 className="hero-item leading-tighter max-w-3xl text-3xl font-semibold tracking-tight text-balance text-primary lg:leading-[1.1] lg:font-semibold xl:text-5xl xl:tracking-tighter">
            Live Events,<br className="hidden md:block" />
            Effortlessly Booked.
          </h1>

          <p className="hero-item max-w-2xl text-base text-balance text-muted-foreground sm:text-lg mb-8 mt-2">
            Microservices, Redis atomic locking, and async Kafka sagas ensure
            safe, fast seat booking — even under high concurrency.
          </p>

          <div className="hero-item flex w-full items-center justify-center gap-2 pt-2">
            <a href="#events">
              <Button size="sm" className="h-[36px] rounded-lg gap-2">
                Browse Events <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
            <Link to="/auth">
              <Button size="sm" variant="ghost" className="h-[36px] rounded-lg">
                Sign In to Book
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Events */}
      <section id="events" className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="flex items-end justify-between mb-10 pb-8 border-b border-border">
          <div>
            <p className="eyebrow text-muted-foreground mb-3">Upcoming</p>
            <h2 className="font-sans font-semibold tracking-tight text-4xl md:text-5xl leading-[1]">Events</h2>
          </div>
          {!loading && events.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-3.5 w-3.5" />
              <span className="font-mono-dm font-medium">{events.length}</span>
              <span>listed</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
            <div className="spinner" />
            Loading events...
          </div>
        )}

        {error && (
          <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-8">
            {error}
          </div>
        )}

        {/* Standard gap-6 grid spacing native to shadcn registry blocks */}
        <div ref={cardsRef} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {!loading && featured.length === 0 && !error && (
          <div className="py-24 text-center">
            <div className="h-12 w-12 border border-border mx-auto mb-5 flex items-center justify-center">
              <Ticket className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">No events available right now.</p>
          </div>
        )}
      </section>
    </main>
  )
}

function EventCard({ event }: { event: Event }) {
  return (
    <Card className="hover:bg-accent/40 hover:border-border/80 group overflow-hidden transition-all duration-300">
      <Link to={`/events/${event.id}`} className="flex h-full flex-col">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={eventImage}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>

        <CardHeader className="px-6 py-4">
          <CardTitle className="text-xl tracking-tight leading-none group-hover:text-foreground/80 transition-colors">
            {event.name}
          </CardTitle>
          <CardDescription className="line-clamp-2 mt-1.5 leading-relaxed">
            {event.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-4 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDateTime(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.venue?.name ?? 'Venue TBA'}</span>
          </div>
        </CardContent>

        <CardFooter className="mt-auto flex items-center justify-between border-t border-border/50 bg-muted/10 px-6 py-4 group-hover:bg-muted/30 transition-colors">
          <div>
            <p className="eyebrow text-muted-foreground mb-0.5">From</p>
            <p className="font-sans font-semibold text-lg">{formatCurrency(event.price)}</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
            View seats
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </CardFooter>
      </Link>
    </Card>
  )
}
