'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react'

const LOADING_STEPS = [
  { id: 1, label: 'Stage 1: AI Intent Parsing & Constraint Extraction...', range: [0, 20] },
  { id: 2, label: 'Stage 2: Retrieving Candidate Places & Live Hotel Data...', range: [20, 60] },
  { id: 3, label: 'Stage 3: Optimizing Route via TSPTW Mathematical Solver...', range: [60, 80] },
  { id: 4, label: 'Stage 4: LLM Synthesizing Contextual Tips & Narratives...', range: [80, 95] },
  { id: 5, label: 'Finalizing Immutable Schedule & Dashboard Sync...', range: [95, 100] },
]

export function NewTripForm() {
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Simulate progress loading states
  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      setActiveStep(0)
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) {
            clearInterval(interval)
            return 98
          }
          const next = prev + Math.floor(Math.random() * 5) + 1
          
          // Determine active step label
          const currentStepIdx = LOADING_STEPS.findIndex(
            step => next >= step.range[0] && next < step.range[1]
          )
          if (currentStepIdx !== -1) {
            setActiveStep(currentStepIdx)
          }
          
          return next > 98 ? 98 : next
        })
      }, 200)

      return () => clearInterval(interval)
    }
  }, [isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || message.length < 5) {
      setError('Please enter a longer prompt (minimum 5 characters).')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/ai/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Generation failed')
      }

      // Finish progress bar instantly on success
      setProgress(100)
      setActiveStep(LOADING_STEPS.length - 1)
      
      // Short delay for visual completion, then redirect
      setTimeout(() => {
        router.push(`/plan/${data.tripId}`)
        router.refresh()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong during generation.')
      setIsLoading(false)
    }
  }

  const applyTemplate = (prompt: string) => {
    if (isLoading) return
    setMessage(prompt)
    setError(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-8 py-8 text-center" role="status" aria-live="polite">
        <div className="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center">
          {/* Shimmer pulse rings */}
          <div className="absolute inset-0 rounded-full bg-accent-primary/10 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-accent-primary/20 animate-pulse" />
          <div className="relative w-16 h-16 bg-accent-primary/30 rounded-full flex items-center justify-center">
            <Sparkles className="text-accent-primary w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-bold text-primary">Generating Your Itinerary</h3>
          <p className="text-sm text-secondary max-w-sm mx-auto h-12">
            {LOADING_STEPS[activeStep]?.label}
          </p>
        </div>

        <div className="max-w-md mx-auto">
          {/* Progress track */}
          <div className="w-full bg-surface border border-border h-3 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-accent-primary to-accent-secondary h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-secondary mt-2 block font-medium">{progress}% Complete</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="prompt" className="text-sm font-semibold text-primary block">
          Your Travel Request
        </label>
        <textarea
          id="prompt"
          name="prompt"
          required
          rows={4}
          placeholder="Where are you going, when, and what do you want to do? E.g., '3 days in Phu Quoc. I want to visit beautiful beaches, try local seafood, and experience nature at a moderate pace with a mid-range budget.'"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (error) setError(null)
          }}
          className="w-full rounded-2xl border border-border bg-surface/50 p-4 text-primary text-sm focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none resize-none transition-all placeholder:text-muted-foreground"
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-warning/10 border border-accent-warning/20 text-accent-warning text-sm" role="alert">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Prompt issue encountered:</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Templates section */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">
          Hackathon Demo Presets
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => applyTemplate('3 days in Phu Quoc. I want to visit beautiful beaches, try local seafood, and experience nature at a moderate pace with a mid-range budget.')}
            className="text-left glass p-4 rounded-2xl hover:border-accent-primary/40 hover:bg-surface/30 transition-colors"
          >
            <span className="font-semibold text-primary text-xs block mb-1 text-accent-primary">
              🟢 Phu Quoc Explorer
            </span>
            <span className="text-[11px] text-secondary line-clamp-2">
              Happy Path: Complete trip details, generates detailed schedule + hotel matching using our Mock Data Provider.
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => applyTemplate('Phu Quoc')}
            className="text-left glass p-4 rounded-2xl hover:border-accent-primary/40 hover:bg-surface/30 transition-colors"
          >
            <span className="font-semibold text-primary text-xs block mb-1 text-accent-warning">
              🟡 Validation Error
            </span>
            <span className="text-[11px] text-secondary line-clamp-2">
              Error Path: Triggers client-side & API-side character length constraint checks.
            </span>
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('3 days in Atlantis, luxury budget.')}
            className="text-left glass p-4 rounded-2xl hover:border-accent-primary/40 hover:bg-surface/30 transition-colors"
          >
            <span className="font-semibold text-primary text-xs block mb-1 text-accent-warning">
              🔴 Unknown Location
            </span>
            <span className="text-[11px] text-secondary line-clamp-2">
              Error Path: Handles unknown cities gracefully using robust cache API failures fallback.
            </span>
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!message.trim()}
        className="w-full bg-accent-primary hover:bg-accent-secondary text-primary font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 transition-all disabled:opacity-50"
      >
        <span>Generate Itinerary</span>
        <ArrowRight size={16} />
      </Button>
    </form>
  )
}
