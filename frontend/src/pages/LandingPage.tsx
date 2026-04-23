import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { CalendarDays, MapPin, Ticket, Zap, Shield, ArrowRight } from 'lucide-react'
import { Event, eventsApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import eventImage from '../assets/Rock_Night.jpg'

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
    timeline.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 32 },
      { opacity: 1, y: 0, stagger: 0.1, duration: 0.9 }
    )

    const cards = cardsRef.current?.querySelectorAll('.event-card')
    if (cards && cards.length > 0) {
      timeline.fromTo(
        cards,
        { opacity: 0, y: 24, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, stagger: 0.07, duration: 0.65 },
        '-=0.4'
      )
    }

    return () => { timeline.kill() }
  }, [events.length])

  const featured = useMemo(() => events.slice(0, 6), [events])

  return (
    <main>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <div className="retro-grid-animated" />
        {/* Background layers */}
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(219,39,119,0.15),transparent)]" />
        <div className="absolute inset-0 -z-20 dot-grid opacity-40" />
        <div className="absolute -z-10 top-0 left-1/4 h-72 w-72 rounded-full bg-pink-500/5 blur-3xl" />
        <div className="absolute -z-10 top-10 right-1/4 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

        {/* Floating decorative pills */}
        <div className="absolute top-16 left-[8%] hidden xl:flex items-center gap-1.5 rounded-2xl border border-pink-500/20 bg-pink-500/5 px-3 py-1.5 text-xs font-mono text-pink-400/80 animate-float backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-pink-500/60" />
          redis://lock:seat
        </div>
        <div className="absolute top-24 right-[7%] hidden xl:flex items-center gap-1.5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-mono text-cyan-300/80 animate-float backdrop-blur-sm" style={{ animationDelay: '1s' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
          booking.confirmed
        </div>
        <div className="absolute bottom-20 left-[12%] hidden xl:flex items-center gap-1.5 rounded-2xl border border-purple-500/20 bg-purple-500/5 px-3 py-1.5 text-xs font-mono text-purple-400/80 animate-float backdrop-blur-sm" style={{ animationDelay: '2s' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400/60" />
          saga: choreography
        </div>

        <div ref={heroRef} className="mx-auto flex w-full max-w-7xl flex-col items-center gap-7 px-4 py-20 text-center md:px-6 md:py-28">
          <div className="hero-item flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-4 py-1.5 text-xs font-semibold text-pink-400 backdrop-blur-sm">
            <Zap className="h-3 w-3" />
            Distributed Ticketing Platform
          </div>

          <h1 className="hero-item max-w-4xl text-5xl font-black leading-[1.05] tracking-[-0.03em] md:text-7xl">
            Book Live Experiences{' '}
            <span className="text-gradient-retro">Without Seat Collisions</span>
          </h1>

          <p className="hero-item max-w-2xl text-base text-muted-foreground md:text-lg leading-relaxed">
            TicketFlow uses microservices, Redis atomic locking, and async Kafka sagas to ensure fast and
            safe seat booking — even under high concurrency.
          </p>

          <div className="hero-item flex flex-wrap justify-center gap-3">
            <a href="#events">
              <Button size="lg" className="animate-pulse-glow gap-2 font-bold px-8 bg-pink-600 hover:bg-pink-500 text-white border-none">
                Explore Events <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 font-bold px-8">
                Sign In To Book
              </Button>
            </Link>
          </div>

          {/* Feature pills */}
          <div className="hero-item flex flex-wrap justify-center gap-3 pt-2 text-xs text-muted-foreground">
            {[
              { icon: Shield, label: 'Redis SETNX Seat Locking' },
              { icon: Zap, label: 'Kafka Choreography Saga' },
              { icon: Ticket, label: '202 Async Booking Flow' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1.5">
                <Icon className="h-3 w-3 text-primary/70" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Events section */}
      <section id="events" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="eyebrow text-primary/60 mb-2">Live Events</p>
            <h2 className="text-3xl font-black tracking-[-0.02em] md:text-4xl">Upcoming Events</h2>
            <p className="mt-2 text-sm text-muted-foreground">Real events from the event service, routed through the gateway.</p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex rounded-full border border-white/8 bg-white/4 px-4 py-2">
            <Ticket className="h-4 w-4 text-primary/60" />
            <span className="font-mono font-medium">{events.length}</span> listed
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            Loading events...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div ref={cardsRef} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {!loading && featured.length === 0 && !error && (
          <div className="py-16 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No events available right now.</p>
          </div>
        )}
      </section>
    </main>
  )
}

function EventCard({ event }: { event: Event }) {
  return (
    <div className="event-card group relative rounded-2xl border border-white/8 bg-card overflow-hidden transition-all duration-300 hover:border-pink-500/40 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgba(236,72,153,0.15)]">
      {/* Top accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative aspect-video w-full overflow-hidden">
        <img
          src={eventImage}
          alt={event.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold tracking-tight leading-snug truncate group-hover:text-pink-400 transition-colors">{event.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">{event.description}</p>
          </div>
          <div className="shrink-0 rounded-lg border border-white/8 bg-white/4 p-2">
            <Ticket className="h-4 w-4 text-pink-500/60" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-pink-500/50 shrink-0" />
            <span>{formatDateTime(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-pink-500/50 shrink-0" />
            <span className="truncate">{event.venue?.name ?? 'Venue TBA'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/6">
          <div>
            <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest mb-0.5">From</p>
            <div className="text-xl font-black text-gradient-retro">{formatCurrency(event.price)}</div>
          </div>
          <Link to={`/events/${event.id}`}>
            <Button size="sm" className="gap-1.5 font-semibold bg-pink-600 hover:bg-pink-500 text-white border-none">
              View Seats <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
