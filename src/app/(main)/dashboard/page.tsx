import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, status')
    .eq('user_id', user?.id || '')
    .order('updated_at', { ascending: false })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">My Trips</h1>
          <p className="text-secondary mt-1">Manage and view your upcoming and past travel plans.</p>
        </div>
        <Link href="/plan/new">
          <Button className="bg-accent-primary hover:bg-accent-secondary text-primary gap-2 rounded-xl">
            <Plus size={18} />
            Create New Trip
          </Button>
        </Link>
      </div>

      {!trips || trips.length === 0 ? (
        <div className="glass p-12 text-center rounded-2xl border-dashed border-2 border-border/50 hover:border-accent-primary/30 transition-colors mt-8">
          <div className="w-20 h-20 bg-accent-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Compass className="text-accent-primary w-10 h-10 animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-primary mb-3">Your Journey Begins Here</h3>
          <p className="text-secondary mb-8 max-w-md mx-auto text-base">
            No trips planned yet. Experience the power of our mathematical scheduling solver and AI narrative generation. Let's build your first optimized itinerary.
          </p>
          <Link href="/plan/new">
            <Button className="bg-accent-primary hover:bg-accent-secondary text-primary font-semibold py-6 px-8 rounded-xl shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/40 transition-all text-lg">
              Start Planning Demo
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/plan/${trip.id}`} className="block group">
              <div className="glass p-6 rounded-2xl h-full border border-border hover:border-accent-primary/50 transition-colors group-hover:bg-surface/50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg text-primary line-clamp-1">{trip.title}</h3>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-surface text-secondary capitalize border border-border">
                    {trip.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-secondary">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-accent-primary" />
                    <span>{trip.destination}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-accent-primary" />
                    <span>
                      {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// Temporary imports since we used icons below
import { Compass, MapPin, Calendar } from 'lucide-react'
