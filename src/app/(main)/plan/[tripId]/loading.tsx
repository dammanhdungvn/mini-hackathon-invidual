export default function PlanLoading() {
  return (
    <div className="plan-workspace animate-pulse" aria-hidden="true">
      {/* Left panel — itinerary skeleton */}
      <aside className="plan-workspace__left" aria-label="Loading itinerary editor">
        <div className="itinerary-panel" aria-busy="true" aria-label="Loading itinerary">
          <header className="itinerary-panel__header mb-6">
            <div className="h-8 w-64 bg-white/10 rounded-lg mb-2" />
            <div className="h-4 w-48 bg-white/10 rounded-md" />
          </header>

          <div className="itinerary-panel__days flex gap-4 overflow-x-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="day-column day-column--skeleton min-w-[320px] bg-white/5 p-4 rounded-2xl border border-border">
                <div className="day-column__header mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 bg-white/10 rounded-full" />
                    <div>
                      <div className="h-5 w-20 bg-white/10 rounded" />
                      <div className="h-4 w-24 bg-white/10 rounded mt-1" />
                    </div>
                  </div>
                  <div className="h-8 w-24 bg-white/10 rounded-lg" />
                </div>

                <div className="day-column__hotel-badge bg-white/5 p-2 rounded-xl mb-4 h-10 flex items-center" />

                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="activity-card activity-card--skeleton bg-white/5 p-4 rounded-xl border border-border h-24">
                      <div className="flex gap-4">
                        <div className="w-12 h-6 bg-white/10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-3/4 bg-white/10 rounded" />
                          <div className="h-4 w-1/2 bg-white/10 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Right panel — map placeholder skeleton */}
      <main className="plan-workspace__right" aria-label="Loading map">
        <div className="plan-workspace__map-placeholder">
          <div className="map-placeholder__content text-center">
            <span className="map-placeholder__icon text-4xl block mb-2 opacity-30">🗺️</span>
            <div className="h-6 w-32 bg-white/10 rounded-md mx-auto mb-2" />
            <div className="h-4 w-48 bg-white/10 rounded-md mx-auto" />
          </div>
        </div>
      </main>
    </div>
  )
}
