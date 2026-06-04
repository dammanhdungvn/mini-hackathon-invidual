# CODE GRAPH
## TripGenius AI — Module Dependencies & Data Flows

> **Last Updated:** 2026-06-04 (Phase 1 Complete)
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

### Planned Dependency Tree (Phase 2–4 additions)

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

### 2B. Itinerary Generation Flow (Phase 2/3 — TO BE BUILT)

```
USER submits travel prompt in ChatPanel
  e.g., "Plan 3 days in Tokyo, mid-range budget, I love food and temples"
    │
    ▼
[POST /api/ai/generate-itinerary]
    │
    ├── STAGE 1: Intent Parsing  (lib/ai/parser.ts)
    │     Input:  user's raw message (string)
    │     Model:  Gemini 2.5 Pro
    │     Output: TravelIntent { destination, dates, budget, interests, pace }
    │     Guard:  Zod schema validation; retry once on failure
    │
    ├── STAGE 2: Candidate Retrieval  (lib/services/)
    │     A. Check places cache in Supabase (TTL = 14 days)
    │        SELECT * FROM places WHERE city = $city AND last_fetched > $ttl
    │     B. If stale/missing → call Google Places API
    │        GET https://places.googleapis.com/v1/places:searchNearby
    │     C. Embed user interests → lib/services/embeddings.ts
    │        → vector similarity search: rpc('match_places', { embedding, threshold })
    │     D. Search hotels: lib/services/amadeus.ts
    │        GET https://test.api.amadeus.com/v2/shopping/hotel-offers
    │     Output: CandidatePlace[] (all validated, no hallucinations)
    │
    ├── STAGE 3: Schedule Optimization  (lib/solver/)
    │     A. Score hotels: lib/solver/scorer.ts → scoreHotel()
    │     B. Score attractions: lib/solver/scorer.ts → scorePlace()
    │     C. Build schedule: lib/solver/tsptw.ts → buildSchedule()
    │        Pure TypeScript. No external calls. Deterministic.
    │        Respects: opening hours, travel times (haversine), user pace
    │     Output: LockedSchedule[] (immutable — LLM cannot modify)
    │
    ├── STAGE 4: Narrative Synthesis  (lib/ai/synthesizer.ts)
    │     Input:  LockedSchedule (places are locked — LLM only annotates)
    │     Model:  Gemini 2.5 Flash
    │     Output: Annotated schedule with ai_tip per activity
    │     Guard:  Zod validation; LLM cannot add/remove/rename places
    │
    └── PERSIST to Supabase
          INSERT INTO trips (...)
          INSERT INTO itinerary_days (...)
          INSERT INTO itinerary_items (...)
          INSERT INTO trip_hotels (...)
    │
    ▼
Response: { tripId, days[], hotels[] }
    │
    ▼
CLIENT redirects to /plan/[tripId]
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

| Feature | New File | Called From | Phase |
|---|---|---|---|
| Auth signout | `app/api/auth/signout/route.ts` | Sidebar form | ⚠️ Missing |
| Shared types | `lib/types/trip.ts`, `lib/types/place.ts` | All Phase 2 files | 2 |
| All prompts | `lib/ai/prompts.ts` | `parser.ts`, `synthesizer.ts`, `chat/route.ts` | 2 |
| Intent parser | `lib/ai/parser.ts` | `api/ai/generate-itinerary/route.ts` | 2 |
| Places cache | `lib/services/google-places.ts` | `api/places/search/route.ts`, itinerary route | 2 |
| Hotel search | `lib/services/amadeus.ts` | `api/hotels/search/route.ts`, itinerary route | 2 |
| Embeddings | `lib/services/embeddings.ts` | `api/ai/generate-itinerary/route.ts` | 2 |
| Haversine | `lib/solver/haversine.ts` | `lib/solver/tsptw.ts` | 2 |
| Scorer | `lib/solver/scorer.ts` | `api/ai/generate-itinerary/route.ts` | 2 |
| Solver | `lib/solver/tsptw.ts` | `api/ai/generate-itinerary/route.ts` | 2 |
| Synthesizer | `lib/ai/synthesizer.ts` | `api/ai/generate-itinerary/route.ts` | 2 |
| Itinerary API | `app/api/ai/generate-itinerary/route.ts` | Frontend ChatPanel | 3 |
| Chat API | `app/api/ai/chat/route.ts` | `components/chat/ChatPanel.tsx` | 3 |
| Places API | `app/api/places/search/route.ts` | Future search UI | 3 |
| Hotels API | `app/api/hotels/search/route.ts` | Future search UI | 3 |
| Trips CRUD | `app/api/trips/route.ts` + `[id]/route.ts` | Dashboard + Plan | 3 |
| ChatPanel | `components/chat/ChatPanel.tsx` | `plan/[tripId]/page.tsx` | 4 |
| TripMap | `components/map/TripMap.tsx` | `plan/[tripId]/page.tsx` (dynamic) | 4 |
| ItineraryPanel | `components/itinerary/ItineraryPanel.tsx` | `plan/[tripId]/page.tsx` | 4 |
| ActivityCard | `components/itinerary/ActivityCard.tsx` | `ItineraryPanel.tsx` | 4 |
| HotelCard | `components/hotels/HotelCard.tsx` | `plan/[tripId]/page.tsx` | 4 |
| Plan page | `app/(main)/plan/[tripId]/page.tsx` | Dashboard link | 4 |
