# CODE GRAPH
## TripGenius AI — Module Dependencies & Data Flows

> **Last Updated:** 2026-06-04 (Phase 2 Complete — Core AI Pipeline + Recommendation Engine)
> **Purpose:** This document maps every dependency edge in the codebase so future AI agents know exactly where to insert new code, which files to modify, and what data flows through the system.
>
> **⚠️ AI AGENT INSTRUCTION:** Read `docs/CODEBASE_MAP.md` first, then this file. Use this graph to locate the correct insertion point for any new feature.

---

## 1. Module Dependency Graph

### Full Dependency Tree (Current State)

```
src/app/layout.tsx (Root HTML shell)
  └─── next/font/google (Inter)
  └─── ./globals.css
  └─── @/lib/utils (cn)

src/middleware.ts (Edge runtime, runs on every request)
  └─── @supabase/ssr (createServerClient)
  └─── next/server (NextRequest, NextResponse)

src/app/(auth)/login/page.tsx  ['use client']
  └─── react (useState)
  └─── next/navigation (useRouter)
  └─── next/link (Link)
  └─── @/lib/supabase/client (createSupabaseBrowserClient)
  │       └─── @supabase/ssr (createBrowserClient)
  │               └─── NEXT_PUBLIC_SUPABASE_URL  [env]
  │               └─── NEXT_PUBLIC_SUPABASE_ANON_KEY  [env]
  └─── @/components/ui/button (Button)
  │       └─── @base-ui/react/button
  │       └─── class-variance-authority
  │       └─── @/lib/utils (cn)
  └─── @/components/ui/input (Input)

src/app/(auth)/signup/page.tsx  ['use client']
  └─── [same as login/page.tsx]

src/app/(main)/layout.tsx  [Server Component]
  └─── @/lib/supabase/server (createSupabaseServerClient)
  │       └─── @supabase/ssr (createServerClient)
  │       └─── next/headers (cookies)
  └─── next/navigation (redirect)
  └─── next/link (Link)
  └─── lucide-react (Map, MapPin, Calendar, Compass, LogOut)

src/app/(main)/dashboard/page.tsx  [Server Component]
  └─── @/lib/supabase/server (createSupabaseServerClient)
  └─── next/link (Link)
  └─── lucide-react (Plus, Compass, MapPin, Calendar)
  └─── @/components/ui/button (Button)
```

### Planned Dependency Tree (Phase 4 UI additions)

```
src/app/api/ai/generate-itinerary/route.ts  [API Route - Phase 3]
  └─── @/lib/supabase/server
  └─── @/lib/ai/parser (parseTravelIntent)
  │       └─── ai (generateObject — Vercel AI SDK)
  │       │       └─── @ai-sdk/google (google — Gemini 2.5 Pro)
  │       └─── zod (TravelIntentSchema)
  │       └─── @/lib/ai/prompts (INTENT_PARSE_PROMPT)
  └─── @/lib/services/google-places (searchPlaces)
  │       └─── @/lib/supabase/server (cache check)
  │       └─── fetch → Google Places API  [external]
  └─── @/lib/services/amadeus (searchHotels)
  │       └─── fetch → Amadeus API  [external]
  └─── @/lib/services/embeddings (embedText)
  │       └─── @ai-sdk/google (embed)
  └─── @/lib/solver/haversine (haversineKm)
  └─── @/lib/solver/scorer (scoreHotel, scorePlace)
  └─── @/lib/solver/tsptw (buildSchedule)
  └─── @/lib/ai/synthesizer (synthesizeNarrative)
  │       └─── ai (generateObject — Vercel AI SDK)
  │       │       └─── @ai-sdk/google (google — Gemini 2.5 Flash)
  │       └─── @/lib/ai/prompts (NARRATIVE_SYNTHESIS_PROMPT)
  └─── @/lib/types/trip (Trip, ItineraryDay, ItineraryItem)
  └─── @/lib/types/place (CandidatePlace, TravelIntent)

src/app/api/ai/chat/route.ts  [API Route - Phase 3]
  └─── @/lib/supabase/server
  └─── ai (streamText)
  └─── @ai-sdk/google (google — Gemini 2.5 Flash)
  └─── @/lib/ai/prompts (CHAT_SYSTEM_PROMPT)

src/app/(main)/plan/[tripId]/page.tsx  [Phase 4]
  └─── @/lib/supabase/server
  └─── @/components/chat/ChatPanel  ['use client']
  └─── @/components/itinerary/ItineraryPanel  ['use client']
  └─── @/components/map/TripMap  [dynamic — ssr:false]
  └─── @/components/hotels/HotelCard

src/components/chat/ChatPanel.tsx  ['use client' - Phase 4]
  └─── ai/react (useChat)
  └─── @/components/ui/input
  └─── @/components/ui/button

src/components/itinerary/ItineraryPanel.tsx  ['use client' - Phase 4]
  └─── @hello-pangea/dnd (DragDropContext, Droppable, Draggable)
  └─── @/components/itinerary/ActivityCard
  └─── @/lib/types/trip (ItineraryItem, ItineraryDay)

src/components/map/TripMap.tsx  ['use client', ssr:false - Phase 4]
  └─── @types/google.maps (Google Maps JS SDK)
  └─── @/lib/types/place (CandidatePlace)
```

### Built Dependency Tree (Phase 2 + Provider Abstraction ✅)

```
# ⭐ Provider abstraction hub — ONLY file that imports @ai-sdk/*
src/lib/ai/provider.ts
  └── @ai-sdk/google   (when AI_PROVIDER=gemini, default)
  └── @ai-sdk/openai   (when AI_PROVIDER=openai)
  └── @ai-sdk/openai   (when AI_PROVIDER=qwen, via createOpenAI)
  Exports: getParserModel(), getSynthesisModel(), getChatModel(), getEmbeddingModel()

# API routes — ZERO direct provider imports
src/app/api/ai/generate-itinerary/route.ts
  └── @/lib/supabase/server
  └── @/lib/ai/parser (parseTravelIntent)
  │       └── ai (generateObject)
  │       └── @/lib/ai/provider (getParserModel)   ← abstraction
  └── @/lib/ai/synthesizer (synthesizeNarrative)
  │       └── ai (generateObject)
  │       └── @/lib/ai/provider (getSynthesisModel) ← abstraction
  └── @/lib/services/recommendations (getRecommendedAttractions, getRecommendedRestaurants)
  │       └── @/lib/services/google-places (searchPlacesNearby)
  │       └── @/lib/solver/scorer (rankPlaces, scoreOpeningHourFit)
  └── @/lib/services/amadeus (searchHotels)
  └── @/lib/solver/tsptw (buildSchedule)
  │       └── @/lib/solver/haversine
  └── @/lib/solver/scorer (scoreHotel)
  └── @/lib/types/trip, @/lib/types/place

src/app/api/ai/chat/route.ts
  └── @/lib/supabase/server
  └── ai (streamText)
  └── @/lib/ai/provider (getChatModel)            ← abstraction
  └── @/lib/ai/prompts (CHAT_SYSTEM_PROMPT)

src/lib/services/embeddings.ts
  └── ai (embed)
  └── @/lib/ai/provider (getEmbeddingModel)       ← abstraction

src/app/api/trips/route.ts
  └── @/lib/supabase/server
  └── zod (validation)

src/app/api/auth/signout/route.ts
  └── @/lib/supabase/server

# ⭐ Hotel Recommendation Engine
src/lib/services/hotel-recommendations.ts
  └── @/lib/services/amadeus (searchHotels)       ← reuses existing, no duplicate
  └── @/lib/solver/scorer (rankHotels → scoreHotelDetailed)
  │       └── @/lib/solver/haversine (centroid distance)
  └── @/lib/ai/provider (getSynthesisModel)       ← abstraction
  └── ai (generateObject)
  └── @/lib/ai/prompts (HOTEL_EXPLANATION_PROMPT)
  └── @/lib/types/trip (TripHotel, RankedHotel, BudgetTier)

src/app/api/hotels/search/route.ts
  └── @/lib/supabase/server (auth)
  └── @/lib/services/hotel-recommendations (getRecommendedHotels)
  └── zod (validation)

src/app/api/trips/[id]/hotels/route.ts
  └── @/lib/supabase/server (auth + ownership check)
  └── zod (validation)

src/components/hotels/HotelCard.tsx
  └── @/lib/types/trip (RankedHotel)  [display only — no data fetching]

# ⭐ Itinerary Editor
src/lib/itinerary/operations.ts
  [pure TypeScript — no imports from any external module]
  Exports: hhmmToMins, minsToHHMM, calcEndTime, isValidTime, isTimeRangeValid,
           removeItemAndResequence, reorderItems, applyTimeEdit, validateItemUpdate

src/app/api/trips/[id]/route.ts              [NEW — Phase 3 complete]
  └── @/lib/supabase/server (auth + ownership)
  └── zod (validation)
  Handlers: GET (full trip + days + items + hotels), PATCH (metadata), DELETE

src/app/api/trips/[id]/items/route.ts        [NEW — Phase 3 complete]
  └── @/lib/supabase/server (auth + ownership)
  └── zod (validation)
  Handlers: PATCH (bulk reorder for drag-and-drop)

src/app/api/trips/[id]/items/[itemId]/route.ts  [NEW]
  └── @/lib/supabase/server (auth + ownership)
  └── @/lib/itinerary/operations (validateItemUpdate, applyTimeEdit, removeItemAndResequence)
  └── zod (validation)
  Handlers: PATCH (edit single item), DELETE (remove + resequence siblings)

src/app/api/ai/regenerate-day/route.ts       [NEW]
  └── @/lib/supabase/server (auth + ownership)
  └── @/lib/services/recommendations (getRecommendedAttractions, getRecommendedRestaurants)  ← reused
  └── @/lib/solver/tsptw (buildSchedule)           ← reused
  └── @/lib/ai/synthesizer (synthesizeNarrative)   ← reused
  └── @/lib/types/trip (TravelIntent, BudgetTier, TravelPace)
  └── zod (validation)

src/components/itinerary/ActivityCard.tsx    [NEW]
  └── @/lib/types/trip (ItineraryItem)       [display + local state only]
  Callbacks: onUpdate, onRemove (delegated to ItineraryPanel → /api/)

src/components/itinerary/DayColumn.tsx       [NEW]
  └── ActivityCard                           [composes]
  └── @/lib/types/trip (ItineraryDay, TripHotel)
  Callbacks: onUpdateItem, onRemoveItem, onRegenerateDay (delegated to ItineraryPanel)

src/components/itinerary/ItineraryPanel.tsx  [NEW]
  └── DayColumn                              [composes]
  └── @/lib/types/trip (ItineraryDay, TripHotel, ItineraryItem)
  → fetch('/api/trips/[id]')                 — load data
  → fetch('/api/trips/[id]/items/[itemId]', PATCH)  — edit item
  → fetch('/api/trips/[id]/items/[itemId]', DELETE) — remove item
  → fetch('/api/ai/regenerate-day', POST)    — regen day

src/app/(main)/plan/[tripId]/page.tsx        [NEW]
  └── @/lib/supabase/server (server-side auth + ownership check)
  └── ItineraryPanel (client component, lazy loaded)
```

---

## 2. Data Flows

### 2A. Dashboard Load Flow (Currently Implemented ✅)

```
USER opens /dashboard
    │
    ▼
[middleware.ts]
  • Creates Supabase client with request cookies
  • Calls supabase.auth.getUser()
  • If no user → redirect to /login
  • If authenticated → passes request through
    │
    ▼
[app/(main)/layout.tsx]  Server Component
  • Calls createSupabaseServerClient()
  • Calls supabase.auth.getUser()
  • If no user → redirect('/login')
  • Renders <Sidebar /> + <MobileNav /> + {children}
    │
    ▼
[app/(main)/dashboard/page.tsx]  Server Component
  • Calls createSupabaseServerClient()
  • Queries: SELECT id, title, destination, start_date, end_date, status
             FROM trips WHERE user_id = $1 ORDER BY updated_at DESC
  • Renders trip grid OR empty state CTA
    │
    ▼
USER sees "My Trips" grid
```

### 2B. Itinerary Generation Flow (✅ Built)

```
POST /api/ai/generate-itinerary  { message: string }
  │
  ├─ STAGE 1: parseTravelIntent()     ← Gemini 2.5 Pro + Zod
  │     Output: TravelIntent
  │
  ├─ STAGE 2: getRecommendedAttractions() + searchHotels()
  │     Attractions: Google Places (cache) → rankPlaces() scorer
  │     Restaurants: Google Places (cache) → rankPlaces() scorer
  │     Hotels:      Amadeus API           → scoreHotel() sort
  │
  ├─ STAGE 3: buildSchedule()          ← Greedy TSPTW (pure TS)
  │     Input:  CandidatePlace[] (validated, no hallucinations)
  │     Output: ScheduledItem[] (immutable — LLM cannot touch)
  │
  ├─ STAGE 4: synthesizeNarrative()    ← Gemini 2.5 Flash + Zod
  │     Annotates ai_tip only — cannot add/remove/rename places
  │
  └─ PERSIST: trips → itinerary_days → itinerary_items + trip_hotels
  │
  Response: { tripId, title, destination, hotels[], days[] }
```

### 2C. Streaming Chat Flow (Phase 3 — TO BE BUILT)

```
USER types in ChatPanel
    │
    ▼
[useChat hook] (ai/react)
  • Sends POST to /api/ai/chat
  • Streams response tokens to UI
    │
    ▼
[POST /api/ai/chat]
  • Auth check (Supabase getUser)
  • streamText({ model: gemini-flash, system: CHAT_SYSTEM_PROMPT, messages })
  • Returns result.toDataStreamResponse()
    │
    ▼ (streaming tokens)
USER sees AI response appear word-by-word
```

### 2D. Drag-and-Drop Reorder Flow (Phase 4 — TO BE BUILT)

```
USER drags an activity card in ItineraryPanel
    │
    ▼
[@hello-pangea/dnd] onDragEnd
  • Calculates new sequence_num order
  • Optimistic UI update (reorder local state immediately)
    │
    ▼
[PATCH /api/trips/[id]/items]
  Body: { dayId, orderedItemIds: string[] }
  • Auth check
  • UPDATE itinerary_items SET sequence_num = $idx WHERE id = $itemId
    │
    ▼
DB updated — no page reload needed
```

---

## 3. Authentication Flow

### 3A. Login Flow

```
USER visits /login
    │
    ▼
[middleware.ts]
  • User is not authenticated → allows through to /login
  • If user IS authenticated → redirect to /dashboard
    │
    ▼
[app/(auth)/login/page.tsx]  'use client'
  • User fills email + password, submits form
    │
    ▼
createSupabaseBrowserClient()
  .auth.signInWithPassword({ email, password })
    │
    ├── ERROR → setError(message) → display inline error
    │
    └── SUCCESS
          • Supabase sets auth cookies in browser
          • router.push('/dashboard') + router.refresh()
    │
    ▼
[middleware.ts — next request]
  • Reads cookie → calls supabase.auth.getUser() → user found
  • Allows through to /dashboard
    │
    ▼
USER sees dashboard
```

### 3B. Session Persistence Flow

```
Every HTTP request
    │
    ▼
[middleware.ts]
  • Reads auth cookie from request
  • Calls supabase.auth.getUser() (validates token, refreshes if expired)
  • Writes refreshed session back into response cookies
  • Passes user context through to Server Components
    │
    ▼
[Server Component] (layout, dashboard, plan/[id])
  • Calls createSupabaseServerClient().auth.getUser()
  • Auth token is valid because middleware already refreshed it
  • No second network call to Supabase Auth required
```

### 3C. Protected Route Map

```
Public routes (no auth required):
  /               → Landing page
  /login          → Login page
  /signup         → Signup page

Protected routes (redirect to /login if not authenticated):
  /dashboard      → Requires user session
  /plan/*         → Requires user session (planned)
  /api/*          → All API routes check auth manually via getUser()

Auto-redirect if already authenticated:
  /login  → /dashboard
  /signup → /dashboard
```

### 3D. Sign Out Flow (Stub — Needs API Route)

```
USER clicks "Sign Out" in Sidebar/MobileNav
    │
    ▼
[form action="/api/auth/signout" method="post"]
    │
    ▼
[POST /api/auth/signout]   ← NOT YET BUILT
  • supabase.auth.signOut()
  • Clears auth cookies
  • redirect('/login')
```

> [!WARNING]
> **Missing:** `/api/auth/signout` route has not been built yet. The Sign Out button in the Sidebar submits to this route but it does not exist. This must be built before the app is testable end-to-end.

---

## 4. Database Flow

### 4A. Read Pattern (Server Component)

```
Server Component
    │
    ▼
createSupabaseServerClient()    ← Always from lib/supabase/server.ts
    │
    ▼
supabase.from('table_name')
  .select('col1, col2, col3')   ← Never select('*')
  .eq('user_id', user.id)       ← Always scope to authenticated user
  .order(...)
    │
    ▼
{ data, error }
  • Check error before accessing data
  • Return data to component for rendering
```

### 4B. Write Pattern (API Route Only)

```
Client Component
    │ fetch()
    ▼
[POST /api/trips]               ← API Route in app/api/
    │
    ▼
1. createSupabaseServerClient().auth.getUser()   ← Auth check FIRST
2. Validate request body with Zod
3. supabase.from('trips').insert({ ... })
4. Return { data: trip } or { error, code }
```

### 4C. Vector Search Pattern (Phase 2)

```
[POST /api/ai/generate-itinerary]
    │
    ▼
lib/services/embeddings.ts
  • embed(userInterests) → vector[1536]
    │
    ▼
supabase.rpc('match_places', {
  query_embedding: vector,
  similarity_threshold: 0.75,
  match_count: 20,
  city: intent.destination
})
    │
    ▼
Returns: CandidatePlace[] sorted by cosine similarity
```

### 4D. Places Cache Pattern (Phase 2)

```
lib/services/google-places.ts
    │
    ▼
1. Check cache:
   SELECT place_id, name, lat, lng, rating, opening_hours, embedding
   FROM places
   WHERE place_id = $id AND last_fetched > NOW() - INTERVAL '14 days'

    ├── HIT → return cached data (no API call)
    │
    └── MISS
          │
          ▼
        fetch(Google Places API)
          │
          ▼
        Validate response with Zod
          │
          ▼
        supabase.from('places').upsert({ ...place, last_fetched: now() })
          │
          ▼
        return fresh data
```

---

## 5. External Integration Points

### Current External Services
| Service | Status | Used In | Notes |
|---|---|---|---|
| Supabase Auth | ✅ Active | `middleware.ts`, all layouts | Session management via cookies |
| Supabase DB | ✅ Active | `dashboard/page.tsx` | Reads trips table |

### Planned External Services

#### 5A. Google Gemini API
```
Integration Point: lib/ai/parser.ts, lib/ai/synthesizer.ts
Entry via: ai (Vercel AI SDK) + @ai-sdk/google
Auth: GOOGLE_GENERATIVE_AI_API_KEY (server-side only, never NEXT_PUBLIC_)

Gemini 2.5 Pro  → Stage 1 (intent parsing, complex reasoning)
Gemini 2.5 Flash → Stage 4 (narrative, cheap + fast)
Gemini Embedding → lib/services/embeddings.ts
```

#### 5B. Google Places API (New)
```
Integration Point: lib/services/google-places.ts
Base URL: https://places.googleapis.com/v1/places
Auth: GOOGLE_PLACES_API_KEY (server-side only)
Field Mask: X-Goog-FieldMask header (only request needed fields)

Used in: Stage 2 (candidate retrieval)
Cache: Supabase places table (14-day TTL)
```

#### 5C. Google Maps JavaScript SDK
```
Integration Point: src/components/map/TripMap.tsx
Load: dynamic(() => import(...), { ssr: false })
Auth: NEXT_PUBLIC_GOOGLE_MAPS_KEY (browser-safe, read-only key)

Renders: interactive map with markers and polylines
Never: SSR — must be client-only dynamic import
```

#### 5D. Amadeus Self-Service API
```
Integration Point: lib/services/amadeus.ts
Base URL: https://test.api.amadeus.com (test) / https://api.amadeus.com (prod)
Auth: AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET (server-side only)
Auth method: OAuth2 client_credentials flow, token cached in memory

Endpoints used:
  GET /v1/reference-data/locations/hotels/by-city   → hotel list
  GET /v2/shopping/hotel-offers                      → pricing

Used in: Stage 2 (hotel candidate retrieval)
```

---

## 6. Future AI Integration Locations

This section maps the exact files and functions where AI features must be added. Use this as a guide to avoid creating files in the wrong location.

### 6A. Where to Add: AI Intent Parser

```
New file: src/lib/ai/parser.ts

Responsibility:
  Takes raw user message string.
  Returns structured TravelIntent object (validated by Zod).

Called from:
  src/app/api/ai/generate-itinerary/route.ts → parseTravelIntent(message)

Do NOT call from:
  Any React component
  Any other API route (use this single module only)

Model: Gemini 2.5 Pro via Vercel AI SDK generateObject()
Prompts: INTENT_PARSE_PROMPT defined in src/lib/ai/prompts.ts
```

### 6B. Where to Add: All LLM Prompts

```
New file: src/lib/ai/prompts.ts

Export one constant per prompt:
  INTENT_PARSE_PROMPT       — Stage 1 system prompt
  NARRATIVE_SYNTHESIS_PROMPT — Stage 4 system prompt
  CHAT_SYSTEM_PROMPT        — Conversational AI system prompt

Rule: NO prompt string may appear anywhere else in the codebase.
      All agents must import from this file.
```

### 6C. Where to Add: Narrative Synthesizer

```
New file: src/lib/ai/synthesizer.ts

Responsibility:
  Takes a LockedSchedule (immutable — set by solver).
  Returns the same schedule annotated with ai_tip per activity.
  NEVER adds, removes, or renames places.

Called from:
  src/app/api/ai/generate-itinerary/route.ts → synthesizeNarrative(schedule)

Model: Gemini 2.5 Flash via Vercel AI SDK generateObject()
```

### 6D. Where to Add: Streaming Chat

```
New file: src/app/api/ai/chat/route.ts

Responsibility:
  Accepts { messages: Message[] } body.
  Streams AI response tokens back to the client.
  Returns result.toDataStreamResponse()

Consumed by:
  src/components/chat/ChatPanel.tsx via useChat() hook from 'ai/react'
```

### 6E. Where to Add: Recommendation Engine

```
Scoring logic:
  New file: src/lib/solver/scorer.ts
  Exports: scoreHotel(hotel, targetPrice), scorePlace(place, userInterests)

Vector matching:
  New file: src/lib/services/embeddings.ts
  Exports: embedText(text: string): Promise<number[]>

Both called from:
  src/app/api/ai/generate-itinerary/route.ts (Stage 2 → Stage 3)

Do NOT call from:
  React components
  The scheduling solver (tsptw.ts)
```

### 6F. Where to Add: Scheduling Solver

```
New file: src/lib/solver/tsptw.ts

Responsibility:
  Pure TypeScript. No async. No external calls.
  Input: CandidatePlace[] (all validated, with coordinates + opening hours)
  Output: ScheduledItem[] (sorted by time, conflicts flagged)

Dependency:
  src/lib/solver/haversine.ts → haversineKm(lat1, lng1, lat2, lng2)

Tests required:
  src/lib/solver/tsptw.test.ts
  See agent_docs/testing.md for required test cases
```

### 6G. Where to Add: Google Places Service

```
New file: src/lib/services/google-places.ts

Responsibility:
  Wraps Google Places API with 14-day Supabase cache.
  Exports: getPlaceDetails(placeId), searchPlacesNearby(city, category)

Cache check pattern:
  1. Query Supabase places table (TTL check)
  2. If HIT → return cached
  3. If MISS → fetch Google API → upsert to cache → return

Called from:
  src/app/api/places/search/route.ts
  src/app/api/ai/generate-itinerary/route.ts (Stage 2)
```

### 6H. Where to Add: Map Components

```
New file: src/components/map/TripMap.tsx
  'use client'
  Loaded via: dynamic(() => import(...), { ssr: false })
  Props: { places: CandidatePlace[], hotels: TripHotel[], center: LatLng }

New file: src/components/map/PlaceMarker.tsx
New file: src/components/map/RoutePolyline.tsx

Used in:
  src/app/(main)/plan/[tripId]/page.tsx
  Right panel of the split-pane layout

NEVER:
  Import TripMap directly in a Server Component
  Use SSR for any map component
```

---

## 7. Integration Insertion Summary

Quick-reference table for any agent adding a new feature:

| Feature | New File | Called From | Status |
|---|---|---|---|
| Auth signout | `app/api/auth/signout/route.ts` | Sidebar form | ✅ Built |
| Shared types | `lib/types/trip.ts`, `lib/types/place.ts` | All Phase 2 files | ✅ Built |
| All prompts | `lib/ai/prompts.ts` | parser, synthesizer, chat | ✅ Built |
| Intent parser | `lib/ai/parser.ts` | generate-itinerary route | ✅ Built |
| Places cache | `lib/services/google-places.ts` | recommendations | ✅ Built |
| Hotel search | `lib/services/amadeus.ts` | generate-itinerary route | ✅ Built |
| Embeddings | `lib/services/embeddings.ts` | generate-itinerary route | ✅ Built |
| Haversine | `lib/solver/haversine.ts` | tsptw, scorer | ✅ Built |
| Scorer | `lib/solver/scorer.ts` | recommendations, route | ✅ Built |
| Recommendations | `lib/services/recommendations.ts` | generate-itinerary route | ✅ Built |
| Solver | `lib/solver/tsptw.ts` | generate-itinerary route | ✅ Built |
| Synthesizer | `lib/ai/synthesizer.ts` | generate-itinerary route | ✅ Built |
| Itinerary API | `app/api/ai/generate-itinerary/route.ts` | Frontend ChatPanel | ✅ Built |
| Chat API | `app/api/ai/chat/route.ts` | ChatPanel.tsx | ✅ Built |
| Trips CRUD | `app/api/trips/route.ts` | Dashboard + Plan | ✅ Built |
| Places API | `app/api/places/search/route.ts` | Future search UI | Phase 3 |
| Hotels API | `app/api/hotels/search/route.ts` | Future search UI | Phase 3 |
| Trips detail | `app/api/trips/[id]/route.ts` | Dashboard + Plan | Phase 3 |
| ChatPanel | `components/chat/ChatPanel.tsx` | plan/[tripId]/page.tsx | Phase 4 |
| TripMap | `components/map/TripMap.tsx` | plan/[tripId]/page.tsx | Phase 4 |
| ItineraryPanel | `components/itinerary/ItineraryPanel.tsx` | plan/[tripId]/page.tsx | Phase 4 |
| ActivityCard | `components/itinerary/ActivityCard.tsx` | ItineraryPanel | Phase 4 |
| HotelCard | `components/hotels/HotelCard.tsx` | plan/[tripId]/page.tsx | Phase 4 |
| Plan page | `app/(main)/plan/[tripId]/page.tsx` | Dashboard link | Phase 4 |
