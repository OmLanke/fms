import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-69px)] max-w-7xl flex-col items-center justify-center px-4 text-center md:px-6">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">Page Not Found</h1>
      <p className="mt-3 max-w-lg text-muted-foreground">The route you requested does not exist in the frontend app.</p>
      <Link to="/" className="mt-6">
        <Button>Back To Home</Button>
      </Link>
    </main>
  )
}
