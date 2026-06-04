# Technical Demo Defense (Q&A Preparation) - TripGenius AI

This document contains expected questions and concise answers for a 5-minute hackathon jury defense. It highlights technical design choices, AI orchestration principles, security practices, and product resilience.

---

## 1. Architecture

### Q1: Why did you choose this stack (Next.js, Supabase, Tailwind, Vercel AI SDK)?
> **Short Answer:** It maximizes developer velocity and handles the scale requirements of a startup (>50k MAU) with zero infrastructure management. TypeScript is used end-to-end (frontend to DB routing), Tailwind ensures responsive layout styling, and Supabase handles auth, relational data, and vector similarity search (`pgvector`) in a single PostgreSQL instance.

### Q2: How does data flow when a user requests an itinerary?
> **Short Answer:**
> 1. The client submits a prompt.
> 2. The Next.js API route passes the prompt to the Stage 1 Parser (Pro LLM) to output a structured JSON search intent.
> 3. The API queries Supabase `pgvector` for attractions matching user interests, retrieves hotel candidates via Amadeus, and fetches missing data from Google Places.
> 4. Structured candidates go to the TypeScript TSPTW routing solver.
> 5. The locked optimized schedule is annotated by the Stage 4 Synthesizer (Flash LLM) and streamed back to the client.

### Q3: How does the hybrid AI-Solver mechanism work?
> **Short Answer:** We split creative synthesis from logical scheduling. Instead of letting the LLM arrange dates and times (where it fails due to weak math reasoning), we use the LLM to extract intent (Stage 1) and summarize the trip (Stage 4). The physical sequencing and constraint checking are handled by a pure, deterministic TypeScript TSPTW (Traveling Salesperson Problem with Time Windows) solver (Stage 3).

---

## 2. AI Implementation & Grounding

### Q4: Why is the LLM prohibited from creating places?
> **Short Answer:** To guarantee grounding and prevent hallucinations. If LLMs invent names, users arrive at non-existent venues. We enforce that all places are fetched from Google Places or the local database cache. The LLM only receives a locked JSON list of real, validated venues and is strictly limited to writing narrative tips.

### Q5: How does your AI Provider Abstraction layer work?
> **Short Answer:** We created a single module (`src/lib/ai/provider.ts`) which acts as the sole entry point for `@ai-sdk/*` imports. The active model (Gemini, OpenAI, or Qwen) is determined entirely by the `AI_PROVIDER` environment variable. Model swaps or provider failovers happen instantly without touching component, API, or solver code.

### Q6: How do you prevent hallucinations in narrative synthesis?
> **Short Answer:**
> 1. We ground the prompt by feeding the LLM only the locked schedule returned by our solver.
> 2. The system prompt instructs the LLM that it cannot add, delete, or rename any venues.
> 3. The LLM's output is structured as a JSON schema and validated with a Zod schema parser. If it introduces outside venues, parsing fails, and the system catches it.

---

## 3. Security & Integrity

### Q7: How is Supabase Row Level Security (RLS) configured?
> **Short Answer:** RLS is enabled on all tables (`trips`, `itinerary_days`, `itinerary_items`, `trip_hotels`, `user_profiles`). We enforce policies where `auth.uid() = user_id`. Users can only select, insert, update, or delete records belonging to their own user IDs. Even if a user knows another trip's UUID, queries to retrieve it are blocked by the database engine.

### Q8: How are external API keys protected?
> **Short Answer:** All sensitive credentials (such as `AMADEUS_CLIENT_SECRET`, `GOOGLE_PLACES_API_KEY`, and LLM keys) are kept strictly server-side. The client never interacts with external endpoints directly. All data fetching is proxied through Next.js serverless API routes (`/api/`) which enforce authentication checks (`supabase.auth.getUser()`) before querying external APIs.

---

## 4. Product & Failure Handling

### Q9: Why did you build an Augmentative tool rather than an Automated one?
> **Short Answer:** Because travel planning is highly subjective. Full automation removes control and builds distrust when things go wrong. By augmenting the planning process, the AI does the heavy lifting of scheduling and distance calculations, but the user retains full agency to drag-and-drop activities, swap hotels, or delete items on a clean canvas.

### Q10: How does the application handle external API downtime or rate limits?
> **Short Answer:**
> 1. **Caching:** All Google Places API results are cached in our database with a 14-day Time-To-Live (TTL) to avoid redundant API billing and survive external downtime.
> 2. **Graceful Fallbacks:** If external APIs fail and cache is missing, the backend defaults to seed datasets (presets) and returns standard travel guides instead of throwing a unhandled exception or crashing the UI.
