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
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
            <Ticket className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-black tracking-tight text-gradient">TicketFlow</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'text-foreground bg-white/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            Home
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/bookings"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/bookings'
                    ? 'text-foreground bg-white/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                My Bookings
              </Link>

              {/* User avatar */}
              <div className="ml-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 py-1">
                <div className="h-6 w-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
                  {user?.email?.charAt(0) ?? 'U'}
                </div>
                <span className="hidden text-xs font-medium text-muted-foreground md:inline max-w-[140px] truncate">
                  {user?.email}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="ml-1 text-muted-foreground hover:text-foreground hover:bg-white/5 text-sm"
              >
                Logout
              </Button>
            </>
          ) : (
            <Link to="/auth" className="ml-2">
              <Button size="sm" className="glow-sm font-semibold">Sign In</Button>
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
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading account...</p>
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
