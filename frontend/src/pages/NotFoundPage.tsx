import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Ticket } from 'lucide-react'

export function NotFoundPage() {
  return (
    <main className="relative isolate mx-auto flex min-h-[calc(100vh-65px)] max-w-7xl flex-col items-center justify-center px-4 text-center md:px-6 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(34,211,238,0.06),transparent)]" />

      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/4 mb-6">
        <Ticket className="h-8 w-8 text-muted-foreground/40" />
      </div>

      <p className="eyebrow text-primary/50 mb-3">404</p>
      <h1 className="text-4xl font-black tracking-[-0.03em] md:text-5xl">Page Not Found</h1>
      <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">
        The route you requested does not exist in the frontend app.
      </p>
      <Link to="/" className="mt-8">
        <Button size="lg" className="font-bold">Back To Home</Button>
      </Link>
    </main>
  )
}
