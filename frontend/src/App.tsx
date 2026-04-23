import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LandingPage } from '@/pages/LandingPage'
import { AuthPage } from '@/pages/AuthPage'
import { EventPage } from '@/pages/EventPage'
import { BookingsPage } from '@/pages/BookingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { Ticket } from 'lucide-react'

function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-6 w-6 border border-foreground bg-foreground flex items-center justify-center shrink-0">
            <Ticket className="h-3 w-3 text-background" strokeWidth={2.5} />
          </div>
          <span className="font-sans font-semibold tracking-tight text-[1.05rem] tracking-[-0.01em]">TicketFlow</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
              location.pathname === '/'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Events
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/bookings"
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  location.pathname === '/bookings'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bookings
              </Link>

              <div className="ml-3 flex items-center gap-2.5 border-l border-border pl-4">
                <div className="h-6 w-6 border border-border bg-muted flex items-center justify-center text-[9px] font-bold text-foreground uppercase shrink-0">
                  {user?.email?.charAt(0) ?? 'U'}
                </div>
                <span className="hidden text-xs text-muted-foreground md:block max-w-[120px] truncate">
                  {user?.email}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <Link to="/auth" className="ml-2">
              <Button size="xs">Sign In</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-24 flex flex-col items-center gap-4">
        <div className="spinner" />
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Loading account...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return children
}

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route
          path="/bookings"
          element={
            <RequireAuth>
              <BookingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}
