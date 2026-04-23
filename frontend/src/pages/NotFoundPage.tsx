import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Ticket } from 'lucide-react'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-7xl flex-col items-center justify-center px-6 text-center">
      <div className="h-14 w-14 border border-border flex items-center justify-center mb-8">
        <Ticket className="h-6 w-6 text-muted-foreground/50" />
      </div>

      <p className="eyebrow text-muted-foreground mb-4">404</p>
      <h1 className="font-sans font-semibold tracking-tight text-5xl md:text-6xl mb-4">Page Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-10">
        The route you requested does not exist in the frontend app.
      </p>
      <Link to="/">
        <Button size="lg">Back to Events</Button>
      </Link>
    </main>
  )
}
