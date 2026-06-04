# CODEBASE MAP
## TripGenius AI

> **Last Updated:** 2026-06-04 (Itinerary Editor complete)
> **Status:** AI pipeline + Hotel Engine + Itinerary Editor built and tested. All Phase 3 API routes complete. Phase 4 plan page scaffolded.
>
> **⚠️ AI AGENT INSTRUCTION:** Read this file **before writing any code**. Search for existing implementations here before creating any new file. Extend existing modules; only create new files when no existing module can accommodate the change.

---

## 1. Architecture Overview

TripGenius AI follows the **Next.js App Router architecture** with a strict separation between server-side logic and client-side interactivity.

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER (Client)                                                │
│  'use client' components only                                    │
│  - Auth forms (login/signup)                                     │
│  - Interactive UI (drag-and-drop, chat panel) — PLANNED          │
│  - Map canvas — PLANNED                                          │
└────────────────────┬─────────────────────────────────────────────┘
                     │ HTTP
┌────────────────────▼─────────────────────────────────────────────┐
│  NEXT.JS APP ROUTER (Server)                                     │
│  - Server Components (default) — dashboard, layouts              │
│  - Route Groups: (auth), (main)                                  │
│  - Middleware: session validation + route protection             │
│  - API Routes (app/api/) — PLANNED for Phase 2/3                 │
└────────────────────┬─────────────────────────────────────────────┘
                     │ Supabase SSR client
┌────────────────────▼─────────────────────────────────────────────┐
│  SUPABASE (Backend-as-a-Service)                                 │
│  - PostgreSQL database (with pgvector)                           │
│  - Supabase Auth (session management)                            │
│  - Row Level Security on all tables                              │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions
- **Server Components by default.** Only add `'use client'` for interactivity.
- **Two Supabase clients only.** `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server). Never create a third.
- **All mutations via API routes.** Components never write to Supabase directly.
- **Route groups** keep auth routes `(auth)` and protected app routes `(main)` isolated.

### Data Source Architecture

**Current Prototype (Mock Mode):**
`Crawled dataset (data_hotel.py)` → `scripts/seed-mock-data.ts` (Normalization) → `supabase/seed.sql` (Mock Dataset) → Service Layer (mock mode) → Recommendation engines.

**Future Production Path:**
`Google Places API` → `google-places.ts` (Places provider interface).
`Amadeus API` → `amadeus.ts` (Hotel provider interface).

*Switching is seamless via the `DATA_SOURCE` environment variable without changing UI, planner, or recommendation logic.*

---

## 2. Folder Responsibilities

```
mini-hackathon-individual/
├── src/
│   ├── app/                    # All routes (App Router only — no pages/)
│   │   ├── (auth)/             # Unauthenticated routes: login, signup
│   │   ├── (main)/             # Authenticated routes: dashboard, plan/[id]
│   │   ├── api/                # API route handlers [TO BE BUILT - Phase 2/3]
│   │   ├── globals.css         # Global CSS + TripGenius design tokens
│   │   └── layout.tsx          # Root HTML shell (Inter font, metadata)
│   │
│   ├── components/
│   │   ├── ui/                 # Shadcn/UI primitives (button, input, etc.)
│   │   ├── layout/             # Shared layout shells [TO BE EXTRACTED]
│   │   ├── chat/               # Chat panel components [TO BE BUILT]
│   │   ├── map/                # Google Maps components [TO BE BUILT]
│   │   ├── itinerary/          # Itinerary components ✅ BUILT
│   │   │   ├── ActivityCard.tsx  # Draggable/editable activity card
│   │   │   ├── DayColumn.tsx     # Single day display with regen button
│   │   │   └── ItineraryPanel.tsx # Top-level panel (fetches + orchestrates)
│   │   └── hotels/             # Hotel card components ✅ BUILT
│   │       └── HotelCard.tsx     # Hotel recommendation card
│   │
│   ├── lib/
│   │   ├── supabase/           # Supabase client instantiation (ONLY here)
│   │   ├── types/              # All shared TypeScript types ✅ BUILT
│   │   │   ├── trip.ts         # BudgetTier, TravelPace, TravelIntent, ScheduledItem, etc.
│   │   │   └── place.ts        # CandidatePlace, PlaceRecord, OpeningHours, etc.
│   │   ├── ai/                 # LLM helpers ✅ BUILT
│   │   │   ├── provider.ts     # ⭐ AI provider abstraction (ONLY file that imports @ai-sdk/*)
│   │   │   ├── prompts.ts      # All prompt strings (single source of truth)
│   │   │   ├── parser.ts       # Stage 1: intent parser (uses provider.ts)
│   │   │   └── synthesizer.ts  # Stage 4: narrative annotator (uses provider.ts)
│   │   ├── itinerary/          # ⭐ Itinerary editing pure functions ✅ BUILT
│   │   │   └── operations.ts   # Time parse, reorder, validate (no side effects)
│   │   ├── services/           # External API clients ✅ BUILT
│   │   │   ├── google-places.ts  # Google Places + 14-day Supabase cache
│   │   │   ├── amadeus.ts        # Hotel search + OAuth2 token cache
│   │   │   ├── embeddings.ts     # Text embeddings (uses provider.ts)
│   │   │   ├── recommendations.ts # Attraction ranking orchestrator
│   │   │   └── hotel-recommendations.ts # ⭐ Hotel ranking + AI explanation
│   │   └── solver/             # Scheduling algorithm ✅ BUILT
│   │       ├── haversine.ts    # Distance + travel time (pure TS)
│   │       ├── scorer.ts       # Hotel + place scoring (4 factors)
│   │       └── tsptw.ts        # Greedy TSPTW scheduler (pure TS)
│   │
│   └── middleware.ts           # Route protection & session refresh
│
├── supabase/
│   ├── migrations/             # ALL schema changes as SQL migration files
│   ├── seed.sql                # Auto-generated mock data seed script (contains mock dataset flow)
│   └── config.toml             # Supabase local dev config
│
├── scripts/
│   ├── mock-hotels.json        # Normalized mock dataset location
│   └── seed-mock-data.ts       # Parses data_hotel.py (pipeline) and generates supabase/seed.sql
│
├── docs/                       # Project planning documents
├── agent_docs/                 # AI agent reference docs
├── AGENTS.md                   # Master coding rules for all agents
└── CLAUDE.md                   # Claude Code-specific rules
```

### Module Boundaries (NEVER cross these)
| Boundary | Rule |
|---|---|
| `lib/supabase/` | Import only from here; never create inline clients |
| `lib/ai/prompts.ts` | All LLM prompt strings live here only |
| `lib/types/` | All shared types live here only — no inline type duplication |
| `app/api/` | Only API routes call external APIs (Google, Amadeus, Gemini) |
| `components/` | Components never call Supabase for writes |

---

## 3. Existing Modules

### 3.1 `src/lib/supabase/client.ts`
| Field | Value |
|---|---|
| **Purpose** | Creates a Supabase client for use inside browser (client) components |
| **Exports** | `createSupabaseBrowserClient()` |
| **Uses** | `@supabase/ssr` `createBrowserClient` |
| **Used by** | Auth pages: `login/page.tsx`, `signup/page.tsx` |
| **When to use** | Any `'use client'` component that needs Supabase access |

### 3.2 `src/lib/supabase/server.ts`
| Field | Value |
|---|---|
| **Purpose** | Creates a Supabase client for Server Components and API routes |
| **Exports** | `createSupabaseServerClient()` |
| **Uses** | `@supabase/ssr` `createServerClient`, `next/headers` `cookies()` |
| **Used by** | `app/(main)/layout.tsx`, `app/(main)/dashboard/page.tsx`, `middleware.ts` |
| **When to use** | Any Server Component, Server Action, or API route handler |

### 3.3 `src/lib/utils.ts`
| Field | Value |
|---|---|
| **Purpose** | Utility for merging Tailwind class names conditionally |
| **Exports** | `cn(...inputs: ClassValue[])` — wraps `clsx` + `tailwind-merge` |
| **Used by** | All components that conditionally apply CSS classes |
| **When to use** | Always use `cn()` instead of string concatenation for Tailwind classes |

### 3.4 `src/middleware.ts`
| Field | Value |
|---|---|
| **Purpose** | Intercepts all requests, refreshes Supabase session, enforces auth |
| **Exports** | `middleware`, `config` (matcher) |
| **Protected routes** | `/dashboard/*`, `/plan/*` → redirects to `/login` if unauthenticated |
| **Auth routes** | `/login`, `/signup` → redirects to `/dashboard` if already logged in |
| **Matcher** | All routes except `_next/static`, `_next/image`, `favicon.ico`, images |

### 3.5 Services & Data Providers

| Module | Responsibility | Public Functions | Dependencies |
|---|---|---|---|
| **Google Places** (`google-places.ts`) | Places provider interface. Fetches from Supabase mock dataset (when `DATA_SOURCE=mock`) or live API. | `searchPlacesNearby` | `supabase/server`, `zod` |
| **Amadeus** (`amadeus.ts`) | Hotel provider interface. Fetches from Supabase mock dataset (when `DATA_SOURCE=mock`) or live API. | `searchHotels` | `supabase/server`, `zod` |
| **Recommendations** (`recommendations.ts`) | Orchestrates candidate retrieval and scoring for attractions/restaurants WITHOUT LLM involvement. | `getRecommendedAttractions`, `getRecommendedRestaurants` | `google-places.ts`, `scorer.ts` |
| **Hotel Recommendations** (`hotel-recommendations.ts`) | Ranks hotels and coordinates AI explanations for the top picks. | `getRecommendedHotels`, `calculateCentroid` | `amadeus.ts`, `scorer.ts`, `provider.ts` |

---

## 4. Component Inventory

### 4.1 UI Primitives (`src/components/ui/`)
These are **Shadcn/UI components** — do not modify their internals directly.

#### `button.tsx`
| Field | Value |
|---|---|
| **Path** | `src/components/ui/button.tsx` |
| **Purpose** | Primary interactive button with variants and sizes |
| **Import** | `import { Button } from '@/components/ui/button'` |
| **Variants** | `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` |
| **Sizes** | `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` |
| **Based on** | `@base-ui/react/button` + `class-variance-authority` |
| **Reuse when** | Any clickable action: forms, CTAs, nav actions |

#### `input.tsx`
| Field | Value |
|---|---|
| **Path** | `src/components/ui/input.tsx` |
| **Purpose** | Styled text input field |
| **Import** | `import { Input } from '@/components/ui/input'` |
| **Reuse when** | All text input fields in forms |

### 4.2 Layout Components (currently defined inline in `layout.tsx`)

> [!NOTE]
> `Sidebar` and `MobileNav` are currently defined as private functions inside `src/app/(main)/layout.tsx`. They will need to be extracted to `src/components/layout/` when they grow beyond 50 lines each or need to be reused.

#### `Sidebar` (inline in `src/app/(main)/layout.tsx`)
| Field | Value |
|---|---|
| **Purpose** | 64px-wide left nav sidebar, visible on `md+` screens |
| **Contains** | Logo link, nav links (My Trips, Calendar, Saved Places), Sign Out form |
| **Reuse** | Do NOT recreate. Extract to `src/components/layout/Sidebar.tsx` when needed |

#### `MobileNav` (inline in `src/app/(main)/layout.tsx`)
| Field | Value |
|---|---|
| **Purpose** | Top header bar, visible on mobile only (`< md`) |
| **Contains** | Logo link, Sign Out button |
| **Reuse** | Do NOT recreate. Extract to `src/components/layout/MobileNav.tsx` when needed |

### 4.3 Plan Creation Components

#### `NewTripForm`
| Field | Value |
|---|---|
| **Path** | `src/components/plan/NewTripForm.tsx` |
| **Purpose** | Prompt entry, template selector, and dynamic generation progress indicator |
| **Import** | `import { NewTripForm } from '@/components/plan/NewTripForm'` |
| **Depends on** | `Button`, `lucide-react` icons |

### 4.4 Pages (Route Segments)

#### `src/app/layout.tsx` — Root Layout
| Field | Value |
|---|---|
| **Purpose** | Root HTML shell for the entire app |
| **Font** | Inter from `next/font/google` — applied via CSS variable `--font-sans` |
| **Metadata** | `title: "TripGenius AI"`, `description: "AI-powered travel planning platform"` |
| **Rule** | Never add page-specific logic here |

#### `src/app/(auth)/login/page.tsx`
| Field | Value |
|---|---|
| **Type** | `'use client'` — uses hooks and Supabase browser client |
| **Purpose** | Email/password login form |
| **Auth flow** | `supabase.auth.signInWithPassword()` → redirect to `/dashboard` |
| **Depends on** | `createSupabaseBrowserClient`, `Button`, `Input` |

#### `src/app/(auth)/signup/page.tsx`
| Field | Value |
|---|---|
| **Type** | `'use client'` |
| **Purpose** | Email/password + full name registration form |
| **Auth flow** | `supabase.auth.signUp()` → redirect to `/dashboard` |
| **Depends on** | `createSupabaseBrowserClient`, `Button`, `Input` |

#### `src/app/(main)/layout.tsx`
| Field | Value |
|---|---|
| **Type** | Server Component (async) |
| **Purpose** | Authenticated root layout wrapping all main app pages |
| **Auth guard** | Calls `supabase.auth.getUser()` server-side; redirects to `/login` if null |
| **Structure** | `Sidebar` (desktop) + `MobileNav` (mobile) + `<main>{children}</main>` |

#### `src/app/(main)/dashboard/page.tsx`
| Field | Value |
|---|---|
| **Type** | Server Component (async) |
| **Purpose** | "My Trips" overview page |
| **Data fetch** | `trips` table: `id, title, destination, start_date, end_date, status` filtered by `user_id` |
| **Empty state** | Renders a CTA card when no trips exist |
| **Filled state** | Renders a responsive grid of trip cards linking to `/plan/[id]` |
| **Depends on** | `createSupabaseServerClient`, `Button`, `lucide-react` icons |

#### `src/app/(main)/plan/new/page.tsx`
| Field | Value |
|---|---|
| **Type** | Server Component (async) |
| **Purpose** | Plan a new adventure page |
| **Auth guard** | Redirects to `/login` if unauthenticated |
| **Structure** | Displays `NewTripForm` |
| **Depends on** | `createSupabaseServerClient`, `NewTripForm` |

---

## 5. Database Map

**Migration files:** [`supabase/migrations/001_initial_schema.sql`](file:///c:/Users/damma/Downloads/WorkSpace/AI-IN-ACTION/day06/mini-hackathon-invidual/supabase/migrations/001_initial_schema.sql), [`supabase/migrations/002_rls_and_indexes.sql`](file:///c:/Users/damma/Downloads/WorkSpace/AI-IN-ACTION/day06/mini-hackathon-invidual/supabase/migrations/002_rls_and_indexes.sql)

### Tables & Relationships

```
auth.users (Supabase managed)
    │
    └──► public.users (id = auth.users.id)
              │
              └──► public.user_profiles (user_id FK)
              │
              └──► public.trips (user_id FK)
                        │
                        ├──► public.trip_hotels (trip_id FK, cascade delete)
                        │
                        └──► public.itinerary_days (trip_id FK, cascade delete)
                                    │
                                    └──► public.itinerary_items (day_id FK, cascade delete)
                                                │
                                                └──► public.places (place_id FK, no cascade)

public.places  ←── standalone cache table (also hosts seeded mock data entities for MVP), no user ownership
```

### Table Summaries

| Table | Primary Key | Purpose |
|---|---|---|
| `users` | `id` (uuid, mirrors auth) | User profile data |
| `user_profiles` | `user_id` | Preferences: budget, pace, interests (with vector embedding) |
| `places` | `place_id` (Google Place ID text) | Google Places cache with 14-day TTL, pgvector embedding |
| `trips` | `id` (uuid) | Master trip record with destination, dates, budget tier |
| `itinerary_days` | `id` (uuid) | One row per day in a trip |
| `itinerary_items` | `id` (uuid) | Scheduled activities: place, times, sequence, ai_tip |
| `trip_hotels` | `id` (uuid) | Ranked hotel recommendations for a trip |

### Key Columns to Know

| Column | Table | Type | Notes |
|---|---|---|---|
| `embedding` | `places` | `vector(1536)` | Semantic similarity search via pgvector |
| `interest_vec` | `user_profiles` | `vector(1536)` | User interest embedding for matching |
| `opening_hours` | `places` | `jsonb` | `{ "mon": ["09:00", "18:00"] }` |
| `sequence_num` | `itinerary_items` | `int` | Drag-and-drop ordering index |
| `last_fetched` | `places` | `timestamptz` | Cache TTL check: reject if older than 14 days |
| `status` | `trips` | `text` | `'draft'` \| `'saved'` \| `'archived'` |
| `ai_tip` | `itinerary_items` | `text` | LLM-generated contextual annotation |

### Indexes
```sql
-- Vector similarity search on places
CREATE INDEX ON public.places USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Place lookup by city and category
CREATE INDEX ON public.places (city, category);

-- Itinerary ordering
CREATE INDEX ON public.itinerary_items (day_id, sequence_num);

-- Trip listing per user
CREATE INDEX ON public.trips (user_id, status);
```

---

## 6. API Map

### Currently Implemented

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/auth/signout` | Sign out + clear session | ✅ |
| `POST` | `/api/ai/generate-itinerary` | Full 4-stage AI pipeline | ✅ |
| `POST` | `/api/ai/regenerate-day` | Partial regeneration (single day) | ✅ |
| `POST` | `/api/ai/chat` | Streaming conversational AI | ✅ |
| `GET/POST` | `/api/trips` | List / create trips | ✅ |
| `GET/PATCH/DELETE` | `/api/trips/[id]` | Get, update, delete a trip | ✅ |
| `PATCH` | `/api/trips/[id]/items` | Bulk reorder itinerary items | ✅ |
| `PATCH/DELETE` | `/api/trips/[id]/items/[itemId]` | Edit / remove a single item | ✅ |
| `GET/PUT` | `/api/trips/[id]/hotels` | Get / save selected hotel | ✅ |
| `GET` | `/api/hotels/search` | Amadeus hotel search | ✅ |

### Remaining API Routes (Phase 3)

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/places/search` | Google Places search with cache | ✅ |

> [!IMPORTANT]
> **All API routes MUST follow the auth-first pattern:**
> ```typescript
> const supabase = createSupabaseServerClient()
> const { data: { user }, error } = await supabase.auth.getUser()
> if (error || !user) return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
> ```

### Standard Error Shape
All API errors return:
```json
{ "error": "Human readable message", "code": "SNAKE_CASE_CODE" }
```

---

## 7. Installed Packages Reference

```json
{
  "dependencies": {
    "next": "14.2.35",
    "react": "^18",
    "react-dom": "^18",
    "@supabase/supabase-js": "^2.107.0",
    "@supabase/ssr": "^0.10.3",
    "@hello-pangea/dnd": "^18.0.1",
    "ai": "^6.0.196",
    "@ai-sdk/google": "latest",
    "zod": "^4.4.3",
    "lucide-react": "^1.17.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0",
    "class-variance-authority": "^0.7.1",
    "@base-ui/react": "^1.5.0",
    "shadcn": "^4.10.0"
  },
  "devDependencies": {
    "vitest": "latest",
    "@vitest/coverage-v8": "latest"
  }
}
```

---

## 8. ❌ DO NOT RECREATE — Duplicate Prevention Rules

### DO NOT create new Supabase client instances
```typescript
// ❌ NEVER DO THIS
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)

// ✅ ALWAYS DO THIS
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
```

### DO NOT recreate these components — they already exist:

| Component | File | Import Path |
|---|---|---|
| `Button` | `src/components/ui/button.tsx` | `@/components/ui/button` |
| `Input` | `src/components/ui/input.tsx` | `@/components/ui/input` |
| `cn()` utility | `src/lib/utils.ts` | `@/lib/utils` |
| `Sidebar` | Inside `src/app/(main)/layout.tsx` | Extract before reusing |
| `MobileNav` | Inside `src/app/(main)/layout.tsx` | Extract before reusing |

### DO NOT recreate these services/modules — they already exist:

| Module | File | What it does |
|---|---|---|
| **AI Provider Abstraction** | `src/lib/ai/provider.ts` | ⭐ Single source of LLM model instances. Only file that imports `@ai-sdk/*`. |
| Haversine distance | `src/lib/solver/haversine.ts` | Distance + travel time |
| Place + Hotel scorer | `src/lib/solver/scorer.ts` | scoreHotel, scoreHotelDetailed, rankHotels, scorePlace, rankPlaces |
| TSPTW solver | `src/lib/solver/tsptw.ts` | buildSchedule |
| Intent parser | `src/lib/ai/parser.ts` | parseTravelIntent (uses provider.ts) |
| Narrative synthesizer | `src/lib/ai/synthesizer.ts` | synthesizeNarrative (uses provider.ts) |
| All prompts | `src/lib/ai/prompts.ts` | INTENT_PARSE_PROMPT, NARRATIVE_SYNTHESIS_PROMPT, CHAT_SYSTEM_PROMPT, HOTEL_EXPLANATION_PROMPT |
| Google Places | `src/lib/services/google-places.ts` | searchPlacesNearby (with 14-day cache and DB mock fallback when `DATA_SOURCE=mock`) |
| Amadeus hotels | `src/lib/services/amadeus.ts` | searchHotels — uses DB mock data fallback when `DATA_SOURCE=mock` or API keys are missing |
| Embeddings | `src/lib/services/embeddings.ts` | embedText, embedInterests (uses provider.ts) |
| Attraction recommendations | `src/lib/services/recommendations.ts` | getRecommendedAttractions, getRecommendedRestaurants |
| **Hotel recommendations** | `src/lib/services/hotel-recommendations.ts` | ⭐ getRecommendedHotels, calculateCentroid — DO NOT duplicate |
| HotelCard UI | `src/components/hotels/HotelCard.tsx` | HotelCard, HotelCardSkeleton — reuse for all hotel displays |
| **Itinerary operations** | `src/lib/itinerary/operations.ts` | ⭐ All pure itinerary edit functions — DO NOT duplicate time/sequence logic |
| **ActivityCard** | `src/components/itinerary/ActivityCard.tsx` | Activity card with inline edit — DO NOT create another card for itinerary items |
| **DayColumn** | `src/components/itinerary/DayColumn.tsx` | Single day display + regenerate — DO NOT recreate |
| **ItineraryPanel** | `src/components/itinerary/ItineraryPanel.tsx` | Top-level panel orchestrator — DO NOT create parallel itinerary UI |
| Shared types | `src/lib/types/trip.ts`, `place.ts` | TripHotel, RankedHotel, HotelRecommendationOptions + all other shared types |
| **NewTripForm** | `src/components/plan/NewTripForm.tsx` | Prompt entry, preset templates, and dynamic loader |

---

## 8.5 AI Workflow & Hallucination Prevention

**Validated Data → AI Explanation Flow**
- **Understands Intent:** The LLM (Gemini Pro) parses user constraints but **does NOT** create places or items.
- **Explains Recommendations:** The LLM (Gemini Flash) annotates a locked schedule with contextual tips.
- **Strict Boundaries:** The LLM **does NOT** create fake attractions, **does NOT** create fake hotels, and **does NOT** invent ratings/prices. All entities are exclusively sourced from the validated database or external APIs.

---

## 8.6 Testing Strategy Overview

- **Seed Tests:** Verified schema match and mock data parsing inside `scripts/`.
- **Provider Tests:** `mock-data.test.ts` validates that both Amadeus and Google Places fallback seamlessly to Supabase mock data when APIs are disconnected.
- **Recommendation Tests:** `recommendations.test.ts` and `hotel-recommendations.test.ts` verify the sorting logic and retrieval without LLM involvement.

### DO NOT create new auth forms
- Login form: `src/app/(auth)/login/page.tsx` already exists
- Signup form: `src/app/(auth)/signup/page.tsx` already exists

### DO NOT add new `page.tsx` files outside `src/app/`

### DO NOT write prompt strings outside `lib/ai/prompts.ts` (once created)

### DO NOT write migration changes directly to Supabase — add a new `.sql` file to `supabase/migrations/`

---

## 9. Future AI Instructions (Mandatory Workflow)

**Every agent MUST follow this checklist before writing any code:**

```
STEP 1 — Read this file (CODEBASE_MAP.md)
STEP 2 — Search for existing files using: grep, list_dir, view_file
STEP 3 — Check Section 8 "DO NOT RECREATE" before creating any file
STEP 4 — Extend existing modules; create new files only when unavoidable
STEP 5 — Follow patterns in agent_docs/code_patterns.md
STEP 6 — Verify TypeScript + ESLint pass before marking a task done
```

### What Needs to Be Built Next (Phase 4 — UI)

| Priority | Module | Path | Notes |
|---|---|---|---|
| 1 | Plan page | `app/(main)/plan/[tripId]/page.tsx` | Split-pane layout |
| 2 | ChatPanel | `components/chat/ChatPanel.tsx` | useChat hook |
| 3 | ItineraryPanel | `components/itinerary/ItineraryPanel.tsx` | Drag-and-drop |
| 4 | ActivityCard | `components/itinerary/ActivityCard.tsx` | Per-item card |
| 5 | HotelCard | `components/hotels/HotelCard.tsx` | Hotel recommendation card |
| 6 | TripMap | `components/map/TripMap.tsx` | Google Maps, SSR:false |
| 7 | PlaceMarker | `components/map/PlaceMarker.tsx` | Map pin |
| 8 | RoutePolyline | `components/map/RoutePolyline.tsx` | Day route line |
