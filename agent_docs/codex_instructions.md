# Codex Instructions
## TripGenius AI — Codex / GitHub Copilot Instructions

Read `AGENTS.md` first. This file supplements it for Copilot/Codex-specific behavior.

---

## Context for Copilot

This is a Next.js 14 App Router TypeScript project. The key conventions to follow are documented in `agent_docs/code_patterns.md`.

Key patterns Copilot should prefer when completing code:

### Supabase Queries
- Import client from `@/lib/supabase/server` (server) or `@/lib/supabase/client` (browser).
- Always specify exact column names in `.select()`, never `.select('*')`.
- Always check `error` before using `data`.

### TypeScript
- Strict mode is enabled. Never use `any`.
- All shared types are in `lib/types/`. Import from there.
- Use Zod for runtime validation of all external API responses.

### API Routes (app/api/)
- First line of every handler: validate auth with `supabase.auth.getUser()`.
- Return consistent error shape: `{ error: string, code: string }`.
- All routes are in `app/api/` directory, export named functions `GET`, `POST`, `PATCH`, `DELETE`.

### Components
- Server Components by default (no `'use client'`).
- Add `'use client'` only for: event handlers, hooks, browser APIs.
- Map components: always use `dynamic(() => import(...), { ssr: false })`.

### AI/LLM
- Never write prompt strings outside of `lib/ai/prompts.ts`.
- Never let the LLM add new places — it only annotates a locked schedule.
- Always validate LLM output with a Zod schema.

---

## File to Create (if not exists)

```
.github/copilot-instructions.md
```

Content: Reference to this file. Copilot reads `.github/copilot-instructions.md` automatically.
