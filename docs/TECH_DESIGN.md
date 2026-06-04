# Technical Design Document
## TripGenius AI — AI Travel Assistant

**Role:** Senior Solution Architect Review  
**Date:** June 4, 2026  
**Status:** Approved for Implementation  
**Reads:** `docs/research-AITravelAssistant.md`, `docs/PRD-AITravelAssistant.md`

---

## Executive Summary

This document defines the complete technical architecture for TripGenius AI. The system is a production-ready, AI-powered travel planning platform. Based on our research and the PRD requirements, we compared three architecture levels and made a final selection optimized for a small team that needs to ship fast, maintain reliably, and scale gracefully.

**Final Selection: Option A (Fast MVP Architecture)**  
With a pre-planned migration path to Option B when user traffic justifies it.

---

## Architecture Option Comparison

### Comparison Matrix

| Dimension | **Option A: Fast MVP** | **Option B: Scalable Startup** | **Option C: Enterprise** |
|---|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | Next.js 14 + TypeScript | Next.js + React Native (Expo) |
| **Backend** | Next.js Route Handlers (Serverless) | Next.js API + Python FastAPI (microservice) | Kubernetes microservices (Node + Python) |
| **Database** | Supabase PostgreSQL | Supabase PostgreSQL + Redis (Upstash) | AWS Aurora PostgreSQL + ElastiCache Redis |
| **Vector Database** | Supabase pgvector (built-in) | Supabase pgvector | Dedicated Qdrant or Pinecone cluster |
| **AI Framework** | Vercel AI SDK + Google Gemini | Vercel AI SDK + LangGraph (Python) | LangGraph + LangSmith + Fine-tuned models |
| **Auth** | Supabase Auth (email + OAuth) | Supabase Auth | Auth0 or Keycloak |
| **Hosting** | Vercel (Frontend + API) + Supabase Cloud | Vercel + Supabase + Fly.io (FastAPI) | AWS ECS / GCP Cloud Run |
| **Maps** | Google Maps JavaScript API | Google Maps JS API + Mapbox fallback | Mapbox GL JS (self-hosted tiles) |
| **Monthly Cost (0-1k users)** | $0–$45/month | $80–$200/month | $500+/month |
| **Monthly Cost (10k users)** | $100–$300/month | $300–$600/month | $1,500+/month |
| **Scalability Ceiling** | ~50,000 MAU | ~500,000 MAU | Unlimited |
| **Dev Complexity** | ⭐ Low | ⭐⭐⭐ Medium | ⭐⭐⭐⭐⭐ High |
| **Time to MVP** | **1–2 weeks** | 3–5 weeks | 3–6 months |
| **Single Language** | ✅ TypeScript only | ❌ TS + Python | ❌ TS + Python + Go/Java |

### Why Option A is Selected

Option A is not a "toy" architecture. Next.js 14 with Supabase is the stack powering production products like Vercel's own dashboard, Supabase's user portal, and thousands of funded startups with millions of users. The key insight is:

> A small team's biggest risk is not future scale — it is failing to ship, iterate, and validate the product quickly enough. Premature architectural complexity kills more products than traffic ever does.

**Option B is clearly documented as the migration path** once the product achieves >10,000 active monthly users and requires dedicated background workers for complex optimization jobs.

---

## Final Architecture: Option A (Fast MVP)

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Web Browser)                       │
│          Desktop / Tablet / Mobile (Responsive Web App)          │
└─────────────────────────────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Edge CDN + Compute)                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              NEXT.JS 14 (App Router)                     │    │
│  │                                                           │    │
│  │  app/                                                     │    │
│  │  ├── (auth)/login, signup          → Auth pages          │    │
│  │  ├── dashboard/                    → Saved trips         │    │
│  │  ├── plan/[tripId]/                → Planning workspace  │    │
│  │  └── api/                          → Route Handlers      │    │
│  │      ├── /ai/chat                  → LLM stream          │    │
│  │      ├── /ai/generate-itinerary    → Hybrid solver       │    │
│  │      ├── /places/search            → Google Places proxy │    │
│  │      ├── /hotels/search            → Amadeus proxy       │    │
│  │      └── /trips/[id]               → Trip CRUD           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐
│  SUPABASE CLOUD  │   │  GOOGLE MAPS     │  │  AMADEUS API     │
│                  │   │  PLATFORM        │  │  (Self-Service)  │
│  • PostgreSQL    │   │                  │  │                  │
│  • pgvector ext  │   │  • Places API    │  │  • Hotel Search  │
│  • Auth (JWT)    │   │  • Maps JS SDK   │  │  • Hotel Details │
│  • Storage       │   │  • Distance Mtx  │  │  • City Codes    │
│  • Realtime      │   │  • Geocoding     │  │                  │
└──────────────────┘   └──────────────────┘  └──────────────────┘
                │
                ▼
┌──────────────────┐
│  GOOGLE AI       │
│  (Gemini API)    │
│                  │
│  • Gemini 2.5 Pro │
│    (parsing)     │
│  • Gemini 2.5    │
│    Flash (synth) │
└──────────────────┘
```

---

## Database Design

### Schema Overview

```sql
-- USERS
create table public.users (
  id            uuid references auth.users primary key,
  email         text unique not null,
  full_name     text,
  avatar_url    text,
  created_at    timestamptz default now()
);

-- USER PREFERENCE PROFILES
create table public.user_profiles (
  user_id       uuid references public.users primary key,
  budget_tier   text check (budget_tier in ('budget', 'mid-range', 'luxury')) default 'mid-range',
  travel_pace   text check (travel_pace in ('slow', 'moderate', 'fast')) default 'moderate',
  interests     text[]   default '{}',           -- e.g., ['museums', 'food', 'nature']
  interest_vec  vector(1536),                    -- OpenAI/Gemini embedding of interests
  updated_at    timestamptz default now()
);

-- PLACES CACHE (avoid repeated API calls)
create table public.places (
  place_id      text primary key,               -- Google Place ID
  name          text not null,
  category      text,                           -- 'attraction' | 'restaurant' | 'hotel'
  latitude      double precision not null,
  longitude     double precision not null,
  address       text,
  rating        numeric(2,1),
  price_level   int check (price_level between 1 and 4),
  opening_hours jsonb,                          -- { "mon": ["09:00", "18:00"], ... }
  photos        jsonb,                          -- Array of photo URLs
  summary       text,
  embedding     vector(1536),                   -- For semantic similarity queries
  last_fetched  timestamptz default now(),
  city          text,
  country       text
);

-- TRIPS (master record)
create table public.trips (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.users not null,
  title         text not null,
  destination   text not null,
  city_code     text,                           -- Amadeus city code, e.g. 'TYO'
  start_date    date not null,
  end_date      date not null,
  adults        int default 1,
  budget_tier   text,
  travel_pace   text,
  user_prompt   text,                           -- Raw user input that created this trip
  status        text default 'draft',           -- 'draft' | 'saved' | 'archived'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ITINERARY DAYS
create table public.itinerary_days (
  id            uuid default gen_random_uuid() primary key,
  trip_id       uuid references public.trips on delete cascade,
  day_number    int not null,
  date          date not null,
  notes         text
);

-- ITINERARY ITEMS (scheduled activities per day)
create table public.itinerary_items (
  id              uuid default gen_random_uuid() primary key,
  day_id          uuid references public.itinerary_days on delete cascade,
  place_id        text references public.places,
  item_type       text check (item_type in ('attraction', 'restaurant', 'hotel', 'transit')),
  start_time      time not null,
  end_time        time not null,
  duration_mins   int,
  sequence_num    int not null,                 -- Ordering index for drag-and-drop
  ai_tip          text,                         -- LLM-generated contextual tip
  transit_to_next jsonb                         -- { "mode": "walk", "duration_mins": 12 }
);

-- HOTEL RECOMMENDATIONS (per trip)
create table public.trip_hotels (
  id              uuid default gen_random_uuid() primary key,
  trip_id         uuid references public.trips on delete cascade,
  amadeus_hotel_id text,
  name            text,
  latitude        double precision,
  longitude       double precision,
  rating          numeric(2,1),
  price_per_night numeric(10,2),
  currency        text default 'USD',
  rank            int                           -- 1, 2, 3 (top picks)
);

-- INDEXES for performance
create index on public.places using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on public.places (city, category);
create index on public.itinerary_items (day_id, sequence_num);
create index on public.trips (user_id, status);
```

---

## API Design

### REST Endpoint Contract

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/chat` | ✅ | Stream conversational AI response. Returns SSE stream. |
| `POST` | `/api/ai/generate-itinerary` | ✅ | Full itinerary pipeline: parse → retrieve → solve → narrate. |
| `GET` | `/api/places/search?q=&city=` | ✅ | Search Google Places with local cache fallback. |
| `GET` | `/api/places/:placeId` | ✅ | Get cached or live place details. |
| `GET` | `/api/hotels/search?city=&dates=&budget=` | ✅ | Search Amadeus hotels by city code and dates. |
| `POST` | `/api/trips` | ✅ | Create new trip record. |
| `GET` | `/api/trips` | ✅ | List all trips for current user. |
| `GET` | `/api/trips/:id` | ✅ | Get single trip with all days and items. |
| `PATCH` | `/api/trips/:id` | ✅ | Update trip metadata (title, dates). |
| `DELETE` | `/api/trips/:id` | ✅ | Delete trip and all child records. |
| `PATCH` | `/api/trips/:id/items` | ✅ | Bulk-update itinerary item ordering after drag-and-drop. |
| `PUT` | `/api/trips/:id/items/:itemId` | ✅ | Update single itinerary item (swap activity). |

### AI Chat Request/Response Schema

```typescript
// POST /api/ai/chat (SSE Stream)
interface ChatRequest {
  tripId?: string;         // Optional: attach conversation to a trip
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
}

// POST /api/ai/generate-itinerary
interface GenerateItineraryRequest {
  tripId: string;
  userPrompt: string;
  destination: string;
  startDate: string;       // ISO date: "2026-07-10"
  endDate: string;
  budgetTier: "budget" | "mid-range" | "luxury";
  travelPace: "slow" | "moderate" | "fast";
  interests: string[];
}

interface GenerateItineraryResponse {
  tripId: string;
  days: ItineraryDay[];
  hotels: HotelRecommendation[];
  mapBounds: { ne: LatLng; sw: LatLng };
}
```

---

## AI Workflow Design

### The 4-Stage Hybrid Pipeline

```
User Prompt Input
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: INTENT PARSING (Gemini 2.5 Pro, ~0.5s)       │
│                                                           │
│  System prompt + user message → structured JSON query   │
│  Output: { destination, dates, budget, interests[] }    │
│  Method: Gemini JSON mode (enforced schema)             │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 2: CANDIDATE RETRIEVAL (Supabase + APIs, ~1–2s) │
│                                                           │
│  a) Vector search: pgvector cosine similarity on        │
│     user interest embedding vs. attraction embeddings   │
│  b) Geospatial filter: places within city bounding box  │
│  c) Rule filter: opening hours cover requested day      │
│  d) Hotel fetch: Amadeus API for top hotel candidates   │
│  Output: 15–25 candidate places + 5–10 hotels          │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 3: SCHEDULE OPTIMIZATION (TypeScript, <0.1s)    │
│                                                           │
│  Greedy TSPTW algorithm:                                │
│  1. Cluster places by geohash proximity                 │
│  2. Assign clusters to days                             │
│  3. Within each day, sort by opening time + distance   │
│  4. Insert travel time gaps between items              │
│  5. Validate no time window conflicts                   │
│  Output: Ordered, time-stamped itinerary schedule      │
│                                                           │
│  Hotel Scoring:                                          │
│  Score = (rating × 0.4) - (|price-target| × 0.3)      │
│         - (dist_to_centroid × 0.2) + (vec_sim × 0.1)  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 4: NARRATIVE SYNTHESIS (Gemini Flash, ~2–4s)    │
│                                                           │
│  Input: structured schedule JSON                        │
│  Task: write engaging summaries, tips, and transitions │
│  Output: Stream narrative to UI in real-time (SSE)     │
│  Key rule: LLM cannot add any places to the schedule   │
│  — it can only annotate the locked schedule            │
└─────────────────────────────────────────────────────────┘
```

---

## Project Folder Structure

```
tripgenius-ai/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group (no main layout)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (main)/                       # Main app route group (with nav layout)
│   │   ├── layout.tsx                # Main app shell (sidebar, navbar)
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Saved trips grid
│   │   └── plan/
│   │       └── [tripId]/
│   │           └── page.tsx          # Trip planning workspace
│   ├── api/                          # API route handlers
│   │   ├── ai/
│   │   │   ├── chat/route.ts
│   │   │   └── generate-itinerary/route.ts
│   │   ├── places/
│   │   │   ├── search/route.ts
│   │   │   └── [placeId]/route.ts
│   │   ├── hotels/
│   │   │   └── search/route.ts
│   │   └── trips/
│   │       ├── route.ts              # GET (list) + POST (create)
│   │       └── [id]/
│   │           ├── route.ts          # GET + PATCH + DELETE
│   │           └── items/route.ts    # Bulk update itinerary items
│   ├── layout.tsx                    # Root layout (fonts, providers)
│   └── page.tsx                      # Landing / marketing page
│
├── components/                       # Reusable UI components
│   ├── ui/                           # Base primitives (buttons, cards, inputs)
│   ├── map/
│   │   ├── TripMap.tsx               # Google Maps canvas component
│   │   ├── PlaceMarker.tsx           # Custom map marker
│   │   └── RoutePolyline.tsx         # Day route renderer
│   ├── itinerary/
│   │   ├── ItineraryPanel.tsx        # Left panel - daily schedule
│   │   ├── DayColumn.tsx             # Single day column
│   │   └── ActivityCard.tsx          # Draggable activity card
│   ├── hotels/
│   │   └── HotelCard.tsx             # Hotel recommendation card
│   ├── chat/
│   │   ├── ChatPanel.tsx             # AI conversational interface
│   │   └── MessageBubble.tsx
│   └── layout/
│       ├── Navbar.tsx
│       └── Sidebar.tsx
│
├── lib/                              # Core business logic
│   ├── ai/
│   │   ├── parser.ts                 # Stage 1: Intent extraction (Gemini)
│   │   ├── synthesizer.ts            # Stage 4: Narrative generation (Gemini Flash)
│   │   └── prompts.ts                # Centralized system prompts
│   ├── solver/
│   │   ├── tsptw.ts                  # Greedy TSPTW scheduling algorithm
│   │   ├── scorer.ts                 # Hotel and attraction scoring functions
│   │   └── haversine.ts              # Geo-distance calculation utility
│   ├── services/
│   │   ├── google-places.ts          # Google Places API client + cache layer
│   │   ├── amadeus.ts                # Amadeus hotel search client
│   │   └── embeddings.ts             # Generate text embeddings (Gemini)
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server-side Supabase client (cookies)
│   │   └── middleware.ts             # Auth session refresh
│   └── types/
│       ├── trip.ts                   # Shared TypeScript interfaces
│       ├── place.ts
│       └── api.ts
│
├── supabase/
│   ├── migrations/                   # SQL migration files (version-controlled)
│   │   └── 001_initial_schema.sql
│   └── seed.sql                      # Development seed data
│
├── middleware.ts                     # Next.js middleware (auth protection)
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env.local                        # Environment variable template
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google APIs
NEXT_PUBLIC_GOOGLE_MAPS_KEY=        # Client-side (maps rendering)
GOOGLE_PLACES_API_KEY=              # Server-side only (Place Details)

# Amadeus
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=

# AI
GOOGLE_GENERATIVE_AI_API_KEY=       # Gemini (Vercel AI SDK)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Deployment Plan

### Phase 1: Local Development
```bash
# 1. Clone and install dependencies
git clone <repo>
cd tripgenius-ai
npm install

# 2. Set up Supabase local dev
npx supabase init
npx supabase start
npx supabase db push

# 3. Configure environment variables
cp .env.example .env.local
# Fill in API keys

# 4. Run development server
npm run dev
```

### Phase 2: Production Deployment

```
Vercel (Frontend + API) ←──── GitHub main branch auto-deploy
Supabase Cloud         ←──── Production database (Pro plan)
```

1. **Supabase**: Create new project on `supabase.com`. Run migrations via `supabase db push --linked`. Enable pgvector extension via SQL editor.
2. **Vercel**: Link GitHub repository. Set environment variables in Vercel dashboard. Enable automatic deployment on `main` branch push.
3. **Domain**: Configure custom domain in Vercel dashboard.
4. **Monitoring**: Enable Vercel Analytics and Supabase's built-in query monitoring dashboards.

---

## Cost Breakdown

### MVP Phase (0–1,000 users/month)

| Service | Plan | Monthly Cost |
|---|---|---|
| Vercel | Hobby (free) → Pro at $20/dev | $0–$20 |
| Supabase | Free tier (2 projects, 500MB, 50k requests) | $0 |
| Gemini API | ~$0.002–$0.006 per itinerary | $0–$15 |
| Google Places | ~$0.02–$0.05 per new city lookup | $0–$20 |
| Amadeus API | Free monthly credits (2k calls) | $0 |
| **Total** | | **$0–$55/month** |

### Growth Phase (10,000 users/month)

| Service | Plan | Monthly Cost |
|---|---|---|
| Vercel | Pro | $20 |
| Supabase | Pro ($25) | $25 |
| Gemini API | Estimated 5,000 itineraries | ~$50 |
| Google Places | Cached efficiently | ~$80 |
| Amadeus API | Pay-as-you-go above free tier | ~$50 |
| **Total** | | **~$225/month** |

---

## Scaling Path: Option A → Option B

When to migrate from Option A to Option B:
- **Traffic trigger:** >50,000 monthly active users
- **Performance trigger:** Scheduling solver exceeds 2 seconds on complex trips (10+ day trips)
- **Feature trigger:** Need for background job queues (async re-planning), real-time collaborative editing

**Migration Steps:**
1. Extract `lib/solver/tsptw.ts` → dedicated Python FastAPI microservice with Google OR-Tools.
2. Add Upstash Redis as a caching layer for API responses and computed itineraries.
3. Deploy FastAPI to Fly.io (low-ops container hosting). Next.js API routes call FastAPI via internal HTTP.
4. Migrate to Supabase Pro's dedicated database for higher connection limits.

---

## Tech Stack Limitations & Mitigations

| Limitation | Severity | Mitigation |
|---|---|---|
| Vercel serverless 60s max execution time | Medium | Break generation into stages; streaming prevents timeout perception |
| pgvector slower than dedicated vector DB at 10M+ vectors | Low (MVP irrelevant) | Migrate to Qdrant if place cache exceeds 500k entries |
| Google Places API cost at high volume | Medium | Aggressive geohash caching, field masking, 14-day TTL |
| Gemini JSON mode occasional schema violations | Low | Wrap all LLM calls in Zod schema validation; retry on failure |
| Next.js bundle size with Google Maps | Low | Load Google Maps JS SDK dynamically, render map client-side only |
