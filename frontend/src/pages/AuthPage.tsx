import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Mode = 'login' | 'register'

interface RedirectState {
  from?: string
}

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
    <main className="mx-auto flex min-h-[calc(100vh-69px)] w-full max-w-md items-center px-4 py-10 md:px-0">
      <Card className="w-full border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Welcome Back' : 'Create Your Account'}</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Sign in to create and manage bookings.' : 'Register to start booking seats.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === 'register' ? (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Register'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))}
              className="font-medium text-primary hover:underline"
            >
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
