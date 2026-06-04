# Tech Stack Reference
## TripGenius AI

This file is the authoritative reference for all technology decisions.
Do not use any technology not listed here without updating TECH_DESIGN.md first.

---

## Core Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js | 14.x (App Router) | Full-stack React framework |
| Language | TypeScript | 5.x | Type safety across entire codebase |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| UI Primitives | shadcn/ui | latest | Accessible, unstyled components |
| Database | Supabase PostgreSQL | 15.x | Primary relational store |
| Vector Search | pgvector (Supabase extension) | 0.7.x | Semantic similarity for attractions |
| Auth | Supabase Auth | built-in | Email + Google OAuth |
| File Storage | Supabase Storage | built-in | User avatars, trip exports |
| AI SDK | Vercel AI SDK | 3.x | Unified LLM + streaming layer |
| LLM (parsing) | Google Gemini 2.5 Pro | API | High-reasoning intent extraction |
| LLM (synthesis) | Google Gemini 2.5 Flash | API | Fast, cheap narrative generation |
| Hotel API | Amadeus Self-Service | v3 | Real-time hotel search & pricing |
| Places API | Google Places API (New) | 2024+ | POI details, autocomplete, photos |
| Maps | Google Maps JavaScript API | weekly | Map rendering, markers, routes |
| Hosting | Vercel | Pro | Edge CDN + serverless compute |
| Schema Validation | Zod | 3.x | Runtime validation of all external data |
| Testing | Vitest | 1.x | Unit and integration tests |

---

## Design System

### Colors
```css
/* Primary palette — dark-mode first */
--bg-base: #0a0a0f;
--bg-surface: #13131a;
--bg-overlay: rgba(255,255,255,0.04);
--border: rgba(255,255,255,0.08);

/* Accent */
--accent-primary: #6366f1;    /* Indigo — primary CTA */
--accent-secondary: #8b5cf6;  /* Purple — secondary */
--accent-success: #10b981;    /* Emerald — success states */
--accent-warning: #f59e0b;    /* Amber — warnings */

/* Text */
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #475569;

/* Map marker colors */
--marker-attraction: #6366f1;
--marker-restaurant: #f59e0b;
--marker-hotel: #10b981;
--marker-transit: #64748b;
```

### Typography
```css
/* From Google Fonts — loaded in app/layout.tsx */
font-family: 'Inter', system-ui, sans-serif;
```

### Spacing & Breakpoints
```
Mobile-first: 375px baseline
Tablet: 768px (md)
Desktop: 1280px (lg)
Wide: 1536px (xl)
```

### Glass-morphism Pattern (for overlays and panels)
```css
.glass {
  background: rgba(13, 13, 26, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
}
```

---

## Key Package Versions

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "react-dom": "18.x",
    "@supabase/supabase-js": "2.x",
    "@supabase/ssr": "0.x",
    "ai": "3.x",
    "@google/generative-ai": "0.x",
    "zod": "3.x",
    "@hello-pangea/dnd": "16.x",
    "geohash": "1.x"
  },
  "devDependencies": {
    "typescript": "5.x",
    "vitest": "1.x",
    "@types/google.maps": "3.x"
  }
}
```

---

## What Is NOT Used (and why)

| Technology | Why Excluded |
|---|---|
| Redux / Zustand | Overkill for MVP; use React Server Components + URL state |
| Prisma / Drizzle | Supabase client is sufficient; avoids extra ORM layer |
| tRPC | Adds complexity; REST routes are simpler for this team size |
| Python backend | Deferred to Option B scaling path; not needed for MVP solver |
| Redis / Upstash | Deferred to Option B; pgvector + Supabase handles MVP caching |
| Pinecone / Qdrant | pgvector is sufficient for MVP vector search scale |
| React Native / Expo | Deferred to V2 post-MVP mobile app |
