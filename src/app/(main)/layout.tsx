import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Map, MapPin, Calendar, Compass, LogOut } from 'lucide-react'

function Sidebar() {
  return (
    <aside className="w-64 glass h-screen sticky top-0 border-r border-border hidden md:flex flex-col">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Compass className="text-accent-primary" size={28} />
          <span className="text-xl font-bold text-primary tracking-tight">TripGenius</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors">
          <Map size={20} />
          <span className="font-medium">My Trips</span>
        </Link>
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-secondary hover:bg-surface transition-colors">
          <Calendar size={20} />
          <span className="font-medium">Calendar</span>
        </Link>
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-secondary hover:bg-surface transition-colors">
          <MapPin size={20} />
          <span className="font-medium">Saved Places</span>
        </Link>
      </nav>

      <div className="p-4 mt-auto">
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-secondary hover:bg-surface transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

function MobileNav() {
  return (
    <header className="md:hidden glass sticky top-0 z-50 flex items-center justify-between p-4 border-b border-border">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Compass className="text-accent-primary" size={24} />
        <span className="text-lg font-bold text-primary tracking-tight">TripGenius</span>
      </Link>
      <form action="/api/auth/signout" method="post">
        <button type="submit" className="text-secondary hover:text-primary">
          <LogOut size={20} />
        </button>
      </form>
    </header>
  )
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-base text-primary font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
