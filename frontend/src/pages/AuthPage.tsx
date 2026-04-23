import { FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Ticket, Loader2, Zap, Shield, Clock } from 'lucide-react'

type Mode = 'login' | 'register'

interface RedirectState {
  from?: string
}

const features = [
  { icon: Zap, title: 'Instant Booking', desc: 'Kafka-powered async processing' },
  { icon: Shield, title: 'Atomic Seat Locks', desc: 'Redis SETNX prevents collisions' },
  { icon: Clock, title: 'Real-time Status', desc: 'Poll until confirmed or failed' },
]

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as RedirectState | null
  const destination = state?.from ?? '/'

  // Auto-redirect if already signed in
  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true })
    }
  }, [isAuthenticated, navigate, destination])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'register') {
        const registered = await authApi.register({ name, email, password })
        await login(registered.token)
      } else {
        const signedIn = await authApi.login({ email, password })
        await login(signedIn.token)
      }
      navigate(destination, { replace: true })
    } catch {
      setError('Authentication failed. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-57px)] border-b border-border">
      <div className="mx-auto grid min-h-[calc(100vh-57px)] max-w-5xl gap-0 md:grid-cols-2">

        {/* Left — branding panel */}
        <div className="hidden md:flex flex-col justify-between border-r border-border p-10 bg-muted/10">
          <div>
            <div className="h-10 w-10 border border-border bg-primary flex items-center justify-center rounded-md mb-8 shadow-sm">
              <Ticket className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>

            <h2 className="font-sans font-semibold tracking-tight text-3xl mb-3">
              {mode === 'login' ? 'Welcome back.' : 'Join TicketFlow.'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {mode === 'login'
                ? 'Sign in to manage your bookings and discover upcoming events.'
                : 'Create an account to start booking seats at live events.'}
            </p>
          </div>

          <div className="space-y-0 rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className={`flex items-start gap-4 p-4 ${i < features.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="h-8 w-8 border border-border bg-background flex items-center justify-center rounded-md shrink-0 shadow-sm">
                  <Icon className="h-4 w-4 text-foreground" strokeWidth={2} />
                </div>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-[350px]">
            <div className="mb-8">
              <div className="mb-8 flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {mode === 'login' ? 'Welcome back' : 'Create an account'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mode === 'login'
                    ? 'Enter your email and password to log in.'
                    : 'Enter your details below to get started.'}
                </p>
              </div>

              <form className="grid gap-6" onSubmit={onSubmit}>
                {mode === 'register' && (
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-muted-foreground">
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      placeholder="Your full name"
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="m@example.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button className="w-full gap-2" type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading
                    ? 'Please wait...'
                    : mode === 'login'
                      ? 'Sign In'
                      : 'Create account'}
                </Button>
              </form>

              <div className="mt-10 pt-6 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode((m) => (m === 'login' ? 'register' : 'login'))
                      setError(null)
                    }}
                    className="font-semibold text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    {mode === 'login' ? 'Register' : 'Sign In'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
