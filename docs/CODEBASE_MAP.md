# CODEBASE MAP
## TripGenius AI

> **Last Updated:** 2026-06-04 (Phase 1 Complete)  
> **Status:** Foundation built. Phase 2 (Core AI Pipeline) is next.
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
│   │   ├── itinerary/          # Itinerary panel & cards [TO BE BUILT]
│   │   └── hotels/             # Hotel card components [TO BE BUILT]
│   │
│   ├── lib/
│   │   ├── supabase/           # Supabase client instantiation (ONLY here)
│   │   ├── types/              # All shared TypeScript types [TO BE BUILT]
│   │   ├── ai/                 # LLM helpers: prompts, parser, synthesizer [TO BE BUILT]
│   │   ├── services/           # External API clients: Places, Amadeus [TO BE BUILT]
│   │   └── solver/             # Scheduling algorithm [TO BE BUILT]
│   │
│   └── middleware.ts           # Route protection & session refresh
│
├── supabase/
│   ├── migrations/             # ALL schema changes as SQL migration files
│   └── config.toml             # Supabase local dev config
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

### 4.3 Pages (Route Segments)

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

---

## 5. Database Map

**Migration file:** [`supabase/migrations/001_initial_schema.sql`](file:///c:/Users/damma/Downloads/WorkSpace/AI-IN-ACTION/day06/mini-hackathon-invidual/supabase/migrations/001_initial_schema.sql)

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

public.places  ←── standalone cache table, no user ownership
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
None yet. API routes are built in Phase 3.

### Planned API Routes (Phase 3)

| Method | Route | Purpose | Auth Required |
|---|---|---|---|
| `POST` | `/api/ai/generate-itinerary` | Full 4-stage AI pipeline | ✅ |
| `POST` | `/api/ai/chat` | Streaming conversational AI | ✅ |
| `GET` | `/api/places/search` | Google Places search with cache | ✅ |
| `GET` | `/api/hotels/search` | Amadeus hotel search | ✅ |
| `GET/POST` | `/api/trips` | List all trips / create new trip | ✅ |
| `GET/PATCH/DELETE` | `/api/trips/[id]` | Get, update, or delete a trip | ✅ |
| `PATCH` | `/api/trips/[id]/items` | Bulk reorder itinerary items | ✅ |

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
    "zod": "^4.4.3",
    "lucide-react": "^1.17.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0",
    "class-variance-authority": "^0.7.1",
    "@base-ui/react": "^1.5.0",
    "shadcn": "^4.10.0"
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

### What Needs to Be Built Next (Phase 2)

The following modules **do not yet exist** and will need to be created:

| Priority | Module | Path | Notes |
|---|---|---|---|
| 1 | Shared TypeScript types | `src/lib/types/trip.ts`, `place.ts` | Define before any AI work |
| 2 | AI prompt registry | `src/lib/ai/prompts.ts` | Centralize all LLM strings |
| 3 | Intent parser | `src/lib/ai/parser.ts` | Gemini 2.5 Pro + Zod schema |
| 4 | Google Places service | `src/lib/services/google-places.ts` | With 14-day cache TTL |
| 5 | Amadeus service | `src/lib/services/amadeus.ts` | Hotel search client |
| 6 | Haversine utility | `src/lib/solver/haversine.ts` | Distance calculation |
| 7 | Hotel scorer | `src/lib/solver/scorer.ts` | Ranking algorithm |
| 8 | TSPTW solver | `src/lib/solver/tsptw.ts` | Greedy scheduling |
| 9 | Narrative synthesizer | `src/lib/ai/synthesizer.ts` | Gemini 2.5 Flash |
| 10 | Itinerary API route | `src/app/api/ai/generate-itinerary/route.ts` | Full 4-stage pipeline |
