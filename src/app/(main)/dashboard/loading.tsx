import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-7xl mx-auto" aria-hidden="true">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary animate-pulse">My Trips</h1>
          <p className="text-secondary mt-1">Manage and view your upcoming and past travel plans.</p>
        </div>
        <Button className="bg-accent-primary/50 text-primary gap-2 rounded-xl cursor-not-allowed opacity-70" disabled>
          <Plus size={18} />
          Create New Trip
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass p-6 rounded-2xl h-40 border border-border flex flex-col justify-between animate-pulse">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="h-6 w-32 bg-white/10 rounded-md" />
                <div className="h-5 w-12 bg-white/5 rounded-full" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-white/10 rounded" />
                  <div className="h-4 w-40 bg-white/10 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-white/10 rounded" />
                  <div className="h-4 w-48 bg-white/10 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
