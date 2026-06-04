# Code Patterns Reference
## TripGenius AI

Canonical code patterns that all agents must follow. Copy these patterns exactly.
Do not invent new patterns — use these.

---

## Pattern 1: Supabase Server Client (API Routes)

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
}
```

---

## Pattern 2: Auth-Protected API Route

```typescript
// app/api/trips/route.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  // ALWAYS auth-check first
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  // Then business logic
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'saved')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json(
      { error: 'Failed to fetch trips', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  return Response.json({ data: trips })
}
```

---

## Pattern 3: Validated LLM Call (Stage 1 — Intent Parser)

```typescript
// lib/ai/parser.ts
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { INTENT_PARSE_PROMPT } from './prompts'

// Zod schema defines the exact contract we expect from the LLM
const TravelIntentSchema = z.object({
  destination: z.string().min(1),
  cityCode: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetTier: z.enum(['budget', 'mid-range', 'luxury']),
  travelPace: z.enum(['slow', 'moderate', 'fast']),
  interests: z.array(z.string()).min(1).max(10),
  avoidCategories: z.array(z.string()).default([]),
})

export type TravelIntent = z.infer<typeof TravelIntentSchema>

export async function parseTravelIntent(userMessage: string): Promise<TravelIntent> {
  const { object } = await generateObject({
    model: google('gemini-2.5-pro'),
    schema: TravelIntentSchema,
    prompt: `${INTENT_PARSE_PROMPT}\n\nUser message: "${userMessage}"`,
  })
  // generateObject with a Zod schema auto-validates — throws on failure
  return object
}
```

---

## Pattern 4: Streaming Chat Route

```typescript
// app/api/ai/chat/route.ts
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts'

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { messages } = await request.json()

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: CHAT_SYSTEM_PROMPT,
    messages,
  })

  return result.toDataStreamResponse()
}
```

---

## Pattern 5: Google Places Cache Pattern

```typescript
// lib/services/google-places.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CACHE_TTL_DAYS = 14

const PlaceCacheSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  rating: z.number().nullable(),
  opening_hours: z.record(z.array(z.string())).nullable(),
})

export async function getPlaceDetails(placeId: string) {
  const supabase = createSupabaseServerClient()
  const ttlDate = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // 1. Try cache first
  const { data: cached } = await supabase
    .from('places')
    .select('place_id, name, latitude, longitude, rating, opening_hours')
    .eq('place_id', placeId)
    .gte('last_fetched', ttlDate)
    .single()

  if (cached) return PlaceCacheSchema.parse(cached)

  // 2. Fetch from Google Places API
  const url = `https://places.googleapis.com/v1/places/${placeId}`
  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      // Field masking — only request what we need
      'X-Goog-FieldMask': 'id,displayName,location,rating,regularOpeningHours',
    },
  })

  if (!response.ok) throw new Error(`Places API error: ${response.status}`)

  const raw = await response.json()
  const place = transformGooglePlaceResponse(raw) // normalize to our schema

  // 3. Upsert into cache
  await supabase.from('places').upsert({
    ...place,
    last_fetched: new Date().toISOString(),
  })

  return PlaceCacheSchema.parse(place)
}
```

---

## Pattern 6: Server Component with Data Fetching

```typescript
// app/(main)/dashboard/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TripCard } from '@/components/dashboard/TripCard'

// No 'use client' — this is a Server Component
export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, status')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <main>
      <h1>My Trips</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trips?.map(trip => <TripCard key={trip.id} trip={trip} />)}
      </div>
    </main>
  )
}
```

---

## Pattern 7: Client Component with Drag-and-Drop

```typescript
'use client'

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { ItineraryItem } from '@/lib/types/trip'

interface ItineraryPanelProps {
  items: ItineraryItem[]
  dayId: string
  onReorder: (dayId: string, orderedItems: ItineraryItem[]) => Promise<void>
}

export function ItineraryPanel({ items, dayId, onReorder }: ItineraryPanelProps) {
  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    
    const reordered = Array.from(items)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)

    await onReorder(dayId, reordered)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId={dayId}>
        {(provided) => (
          <ul ref={provided.innerRef} {...provided.droppableProps}>
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided) => (
                  <li ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                    {/* ActivityCard goes here */}
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </DragDropContext>
  )
}
```

---

## Pattern 8: Dynamic Map Import (SSR-safe)

```typescript
// components/map/TripMap.tsx — client component
'use client'

// In the page that uses TripMap:
import dynamic from 'next/dynamic'

// Never import TripMap directly in a Server Component
const TripMap = dynamic(() => import('@/components/map/TripMap'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-surface h-full rounded-2xl" />,
})
```

---

## Pattern 9: Haversine Distance Utility

```typescript
// lib/solver/haversine.ts

/** Returns distance in kilometers between two lat/lng points */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
```

---

## Anti-patterns (Never Do This)

```typescript
// ❌ DON'T: Inline Supabase client
const supabase = createClient(process.env.URL!, process.env.KEY!)

// ❌ DON'T: select('*')
await supabase.from('places').select('*')

// ❌ DON'T: LLM generating place names
const prompt = `Suggest 5 restaurants in Tokyo`

// ❌ DON'T: No Zod validation on LLM output
const rawJson = JSON.parse(llmResponse.text)
const itinerary = rawJson as Itinerary // unsafe cast

// ❌ DON'T: API keys in client component
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

// ❌ DON'T: Supabase write from React component
await supabase.from('trips').insert({ ... }) // inside a component

// ❌ DON'T: any type
const data: any = await response.json()
```
