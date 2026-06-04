# AGENTS.md — TripGenius AI
> **Master AI Coding Instructions** for all agents: Antigravity, Codex, Claude Code.  
> Read this file before writing any code. Follow every rule here exactly.

---

## 1. Project Overview

| Field | Value |
|---|---|
| **Product** | TripGenius AI — AI-powered travel planning platform |
| **Stack** | Next.js 14 (App Router) · TypeScript · Supabase · Vercel AI SDK · Gemini API |
| **Database** | Supabase PostgreSQL + pgvector extension |
| **External APIs** | Google Places API · Google Maps JS SDK · Amadeus Self-Service API |
| **Hosting** | Vercel (frontend + serverless API) + Supabase Cloud (database + auth) |
| **Current Phase** | MVP Build |
| **Docs** | `docs/research-AITravelAssistant.md` · `docs/PRD-AITravelAssistant.md` · `docs/TECH_DESIGN.md` |

---

## 2. How Agents Should Think

Before writing any code, follow this mandatory mental model:

```
UNDERSTAND → LOCATE → PLAN → CODE → VERIFY → EXPLAIN
```

1. **UNDERSTAND** — Read the task carefully. If ambiguous, check the PRD and TECH_DESIGN before assuming.
2. **LOCATE** — Find existing code first. Never create a duplicate. Search `lib/`, `components/`, `app/api/`.
3. **PLAN** — List the files you will create or modify before touching anything.
4. **CODE** — Write the implementation following all rules in Section 4.
5. **VERIFY** — Check: Does it compile? Does it break existing types? Does it follow the schema?
6. **EXPLAIN** — Add a short comment above every non-trivial function describing what it does.

---

## 3. Context Files Reference

Always read these files before working on a feature:

| File | When to Read |
|---|---|
| `docs/CODEBASE_MAP.md` | **FIRST — before any coding task** (duplicate prevention) |
| `docs/CODE_GRAPH.md` | **SECOND — before adding any new module or API route** (insertion points) |
| `docs/TECH_DESIGN.md` | Before any architectural decision |
| `docs/PRD-AITravelAssistant.md` | Before building any user-facing feature |
| `lib/types/trip.ts` | Before working with any trip, day, or itinerary item data |
| `lib/types/place.ts` | Before working with places, hotels, or map markers |
| `lib/ai/prompts.ts` | Before modifying any LLM prompt |
| `supabase/migrations/` | Before adding or changing any database table |
| `agent_docs/code_patterns.md` | Before writing any service, component, or API route |

---

## 4. Universal Coding Rules

These rules apply to ALL agents (Antigravity, Codex, Claude Code) at ALL times.

### 4.1 Architecture Rules — NEVER VIOLATE

- **Follow `docs/TECH_DESIGN.md` exactly.** Do not introduce new infrastructure, services, or databases not listed there.
- **Use Next.js App Router only.** Do not use the `pages/` directory. All routes go in `app/`.
- **API keys are server-side only.** `GOOGLE_PLACES_API_KEY`, `AMADEUS_CLIENT_ID/SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must never appear in client components or be prefixed with `NEXT_PUBLIC_`.
- **Only two Supabase clients exist:** `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server/API routes). Never create inline Supabase clients.
- **All database mutations go through API routes.** React components and hooks must never call Supabase directly for writes; they call `/api/` endpoints.
- **Auth is always enforced.** Every API route must verify the session with the Supabase server client before processing.

### 4.2 TypeScript Rules

- **Strict mode is always on.** `"strict": true` in `tsconfig.json`. No `any` types.
- **All shared types live in `lib/types/`.** If a type is used in more than one file, extract it.
- **Zod for all external data.** Every response from the Gemini API, Google Places API, and Amadeus API must be validated with a Zod schema before use. Never trust external data.
- **No type assertions (`as X`)** unless the alternative is genuinely impossible to type safely. Leave a comment explaining why.
- **Enums for fixed sets of values.** Use TypeScript string literal unions for types like `BudgetTier`, `TravelPace`, `ItemType`.

```typescript
// ✅ CORRECT — shared types in lib/types/
export type BudgetTier = 'budget' | 'mid-range' | 'luxury'
export type TravelPace = 'slow' | 'moderate' | 'fast'
export type ItemType = 'attraction' | 'restaurant' | 'hotel' | 'transit'

// ❌ WRONG — inline types duplicated everywhere
const tier: string = 'budget'
```

### 4.3 Component Rules

- **Server Components by default.** Only add `'use client'` when you need browser APIs, event handlers, or React hooks (`useState`, `useEffect`, etc.).
- **One responsibility per component.** If a component file exceeds 200 lines, it should be split.
- **No business logic in components.** Data fetching, API calls, and computations belong in `lib/` or API routes, not inside JSX components.
- **Props must be typed.** Every component must have an explicit interface or type for its props.
- **Map components are always client-only.** Load Google Maps with `dynamic(() => import(...), { ssr: false })`.

```typescript
// ✅ CORRECT — typed props, server component by default
interface ActivityCardProps {
  item: ItineraryItem
  onSwap: (itemId: string) => void
}

export function ActivityCard({ item, onSwap }: ActivityCardProps) { ... }
```

### 4.4 AI & LLM Rules — CRITICAL

- **All prompts are centralized in `lib/ai/prompts.ts`.** No prompt strings anywhere else.
- **The LLM cannot create places.** Stage 4 (narrative synthesis) receives a locked, pre-validated schedule. The LLM is only allowed to annotate it — never add, remove, or rename places.
- **All LLM outputs are Zod-validated.** Use Gemini's JSON mode with a defined schema. Wrap in try/catch and retry once on schema validation failure.
- **Use Gemini 2.5 Pro for parsing (Stage 1).** Use Gemini 2.5 Flash for narrative synthesis (Stage 4). This controls cost.
- **Streaming for chat.** `/api/ai/chat` must use `streamText` from the Vercel AI SDK and return a `StreamingTextResponse`. Never buffer the full response.
- **No hallucination guard bypass.** Never prompt the LLM with "feel free to suggest any place you know of." All suggestions must come from the validated candidate pool.

```typescript
// ✅ CORRECT — LLM only annotates locked schedule
const synthesisPrompt = buildNarrativePrompt(lockedSchedule) // from lib/ai/prompts.ts
const result = await generateText({ model: flashModel, prompt: synthesisPrompt })
const validated = NarrativeResponseSchema.parse(JSON.parse(result.text)) // Zod validation

// ❌ WRONG — LLM inventing places
const result = await generateText({
  prompt: `Suggest great restaurants in Tokyo for my traveler`
})
```

### 4.5 Database Rules

- **All schema changes are migrations.** Add a new file to `supabase/migrations/`. Never modify the database directly via the dashboard for schema changes.
- **Use the exact column names from `docs/TECH_DESIGN.md`.** Do not rename or add columns without updating the schema, types, and migration files simultaneously.
- **Select only needed columns.** Never use `select('*')` in Supabase queries. Always specify columns.
- **Row Level Security (RLS) is always enabled.** Every table must have RLS policies. Users can only access their own `trips`, `itinerary_days`, `itinerary_items`, and `trip_hotels`.
- **Places cache TTL is 14 days.** Before calling Google Places API, always check if `places.last_fetched` is within 14 days. If so, serve from cache.

```typescript
// ✅ CORRECT — select specific columns, check cache TTL
const { data: cached } = await supabase
  .from('places')
  .select('place_id, name, latitude, longitude, rating, opening_hours, embedding')
  .eq('place_id', placeId)
  .gte('last_fetched', fourteenDaysAgo)
  .single()

// ❌ WRONG — select *
const { data } = await supabase.from('places').select('*')
```

### 4.6 API Route Rules

- **Auth check is first.** Every route handler must validate the Supabase session before any other logic.
- **Return consistent error shapes.** All errors return `{ error: string, code: string }` with appropriate HTTP status codes.
- **No raw SQL strings.** Use Supabase's query builder. For vector queries, use the `rpc()` method calling a defined Postgres function.
- **Rate limit external API calls.** Wrap Google Places and Amadeus calls in try/catch. Return cached data on external API failure; never crash the route.

```typescript
// ✅ CORRECT — auth first, consistent errors
export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  // ... rest of handler
}
```

### 4.7 Solver Rules

- **The scheduling solver (`lib/solver/tsptw.ts`) is pure TypeScript.** No external API calls inside the solver.
- **Solver input is always pre-validated.** The solver receives a `CandidatePlace[]` array where all places have confirmed coordinates, opening hours, and ratings.
- **Solver output is deterministic.** Given the same input, the solver must return the same schedule. No randomness unless for tie-breaking.
- **Time window conflicts are surfaced, not silently dropped.** If no valid schedule can be produced, return an error object with the conflicting item IDs.

---

## 5. Build Roadmap & Phases

### Phase 1 — Foundation (Week 1)
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure Supabase (local + cloud) and run initial migration
- [ ] Set up `lib/supabase/client.ts` and `lib/supabase/server.ts`
- [ ] Implement auth pages: `/login`, `/signup` with Supabase Auth
- [ ] Create Next.js middleware for route protection
- [ ] Define all shared TypeScript types in `lib/types/`
- [ ] Build landing page (`app/page.tsx`)

### Phase 2 — Core AI Pipeline (Week 1–2)
- [ ] Implement `lib/ai/prompts.ts` — all system prompts
- [ ] Implement `lib/ai/parser.ts` — Stage 1 intent extraction (Gemini Pro + Zod)
- [ ] Implement `lib/services/google-places.ts` — cached Places client
- [ ] Implement `lib/services/amadeus.ts` — hotel search client
- [ ] Implement `lib/services/embeddings.ts` — Gemini text embedding
- [ ] Implement `lib/solver/haversine.ts` — distance utility
- [ ] Implement `lib/solver/scorer.ts` — hotel and attraction scoring
- [ ] Implement `lib/solver/tsptw.ts` — greedy scheduling algorithm
- [ ] Implement `lib/ai/synthesizer.ts` — Stage 4 narrative (Gemini Flash)
- [ ] Build `/api/ai/generate-itinerary` — full 4-stage pipeline

### Phase 3 — API Layer (Week 2)
- [ ] Build `/api/ai/chat` — streaming conversational AI
- [ ] Build `/api/places/search` — Places search with cache
- [ ] Build `/api/hotels/search` — Amadeus hotel search
- [ ] Build `/api/trips` — Trip CRUD (list + create)
- [ ] Build `/api/trips/[id]` — Trip CRUD (get + update + delete)
- [ ] Build `/api/trips/[id]/items` — Bulk itinerary item update

### Phase 4 — UI Build (Week 2–3)
- [ ] Build `components/layout/Navbar.tsx` and `Sidebar.tsx`
- [ ] Build `app/(main)/dashboard/page.tsx` — saved trips grid
- [ ] Build `components/chat/ChatPanel.tsx` — AI conversation interface
- [ ] Build `components/map/TripMap.tsx` — Google Maps canvas (dynamic, client-only)
- [ ] Build `components/map/PlaceMarker.tsx` and `RoutePolyline.tsx`
- [ ] Build `components/itinerary/ItineraryPanel.tsx` — daily schedule view
- [ ] Build `components/itinerary/ActivityCard.tsx` — draggable activity card
- [ ] Build `components/hotels/HotelCard.tsx` — hotel recommendation card
- [ ] Build `app/(main)/plan/[tripId]/page.tsx` — full planning workspace

### Phase 5 — Polish & Deploy (Week 3)
- [ ] Add drag-and-drop reordering to `ItineraryPanel`
- [ ] Add "Swap Activity" functionality to `ActivityCard`
- [ ] Add opening hours conflict warning to activity cards
- [ ] Configure Vercel project and environment variables
- [ ] Run `supabase db push --linked` against production database
- [ ] Enable pgvector extension in production Supabase project
- [ ] Deploy to Vercel, validate all flows end-to-end

---

## 6. What NOT To Do

| ❌ Prohibited | ✅ Alternative |
|---|---|
| Using `pages/` directory | Use `app/` with App Router |
| Creating inline Supabase clients | Import from `lib/supabase/client.ts` or `server.ts` |
| Putting API keys in client components | Keep server-side keys in API routes only |
| Letting LLM generate place names | Ground all places via Google Places or Amadeus API |
| Using `select('*')` in Supabase queries | Always specify exact column names |
| Calling external APIs from React components | Always call through `/api/` route handlers |
| Writing prompts inline in route handlers | Import from `lib/ai/prompts.ts` |
| Ignoring Zod validation on LLM output | Always validate with `Schema.parse()` |
| Modifying database via dashboard | Write a migration in `supabase/migrations/` |
| Adding new infrastructure (Redis, new DB) | Follow TECH_DESIGN.md; discuss first |
| Duplicating type definitions across files | Centralize in `lib/types/` |
| Using `any` type | Use proper types or unknown + type guard |

---

## 7. Testing Requirements

Test the following critical business logic:

```
lib/solver/tsptw.ts           — Unit tests for scheduling algorithm
lib/solver/scorer.ts          — Unit tests for hotel scoring formula
lib/ai/parser.ts              — Integration test with mock Gemini response
lib/services/google-places.ts — Unit test for cache TTL logic
```

Minimum test cases for `tsptw.ts`:
- Places with no time conflicts → sorted, valid output
- Place with time window conflict → conflict returned in error
- Single place → single-item schedule
- Empty input → empty schedule, no error

Use Vitest: `npm run test`

---

## 8. Design System Guidelines

All UI must follow these conventions:

- **Font:** `Inter` from Google Fonts (loaded via `app/layout.tsx`)
- **Color palette:** Dark mode with glass-morphism overlays (see `agent_docs/tech_stack.md`)
- **Mobile-first breakpoints:** Design for 375px first, then expand to 768px and 1280px
- **Map layout:** The trip planning workspace (`/plan/[tripId]`) is always a split-pane: left panel (chat + itinerary) and right panel (full-height map)
- **Skeleton loading:** All async data must have a skeleton state, never an empty blank area
- **Card-based UI:** Hotels, activities, and attractions are always presented as cards with hover states

---

## 9. Environment Setup Checklist

Before running the project, verify `.env.local` has all required variables:

```bash
# Required — app will not start without these
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Required for data features
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
GOOGLE_PLACES_API_KEY=
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
```

Run database setup:
```bash
npx supabase start         # Start local Supabase
npx supabase db push       # Apply migrations
npm run dev                # Start Next.js
```
