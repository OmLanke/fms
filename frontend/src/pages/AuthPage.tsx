import { FormEvent, useState } from 'react'
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

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as RedirectState | null
  const destination = state?.from ?? '/'

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
    <main className="relative isolate min-h-[calc(100vh-65px)] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.1),transparent)]" />
      <div className="absolute inset-0 -z-10 dot-grid opacity-30" />

      <div className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-5xl items-center px-4 py-12 md:px-6">
        <div className="w-full grid md:grid-cols-2 gap-12 items-center">

          {/* Left — branding */}
          <div className="hidden md:block space-y-8">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-[-0.025em]">
                  {mode === 'login' ? 'Welcome back.' : 'Join TicketFlow.'}
                </h2>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {mode === 'login'
                    ? 'Sign in to manage your bookings and discover upcoming events.'
                    : 'Create an account to start booking seats at live events.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="rounded-2xl border border-white/8 bg-card p-7 shadow-2xl">
            <div className="mb-6">
              <h3 className="text-xl font-black tracking-tight">
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === 'login'
                  ? 'Enter your credentials to continue.'
                  : 'Fill in the details to get started.'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    placeholder="Your full name"
                    className="border-white/10 bg-white/4 focus:border-primary/40 focus:bg-white/6 placeholder:text-muted-foreground/40"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="border-white/10 bg-white/4 focus:border-primary/40 focus:bg-white/6 placeholder:text-muted-foreground/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                  className="border-white/10 bg-white/4 focus:border-primary/40 focus:bg-white/6 placeholder:text-muted-foreground/40"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button className="w-full font-bold gap-2 mt-2" size="lg" type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-5 text-center text-xs text-muted-foreground border-t border-white/6 pt-5">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => { setMode((m) => (m === 'login' ? 'register' : 'login')); setError(null) }}
                className="font-semibold text-primary hover:underline"
              >
                {mode === 'login' ? 'Register' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
