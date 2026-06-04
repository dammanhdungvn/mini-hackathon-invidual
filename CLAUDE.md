# CLAUDE.md
## TripGenius AI — Claude Code Instructions

Read `AGENTS.md` first. This file supplements it for Claude Code-specific behavior.

---

## Claude Code Behavior Rules

### Before Every Task
1. Run `cat AGENTS.md` to load the master rules.
2. Run `cat agent_docs/code_patterns.md` for canonical patterns.
3. Check the current file structure with `ls -la app/ lib/ components/`.

### When Generating Code
- Use the exact patterns from `agent_docs/code_patterns.md`.
- Do not install new npm packages without checking `agent_docs/tech_stack.md` first.
- Prefer editing existing files over creating new ones when extending functionality.

### When Modifying the Database
- Always write a new migration file in `supabase/migrations/`.
- Name it: `00N_description.sql` (increment N).
- Never run `ALTER TABLE` directly in development without a migration.

### Commit Message Format
```
feat: add hotel scoring algorithm to lib/solver/scorer.ts
fix: correct opening hours validation in tsptw solver
refactor: extract place cache TTL logic to shared constant
test: add unit tests for haversine distance utility
```

### When Stuck
1. Re-read the relevant section of `docs/TECH_DESIGN.md`.
2. Check `agent_docs/code_patterns.md` for the pattern.
3. If genuinely ambiguous, leave a `// TODO:` comment and continue with other tasks.

---

## High-Priority Rules for Claude

- **Never use `any` type.** If you're tempted to use `any`, use `unknown` and add a type guard.
- **Never skip Zod validation** on data coming from Gemini, Google Places, or Amadeus.
- **Always handle the `error` case** returned by Supabase before accessing `data`.
- **Check RLS policies** whenever adding a new table. Add matching RLS policies in the same migration.

---

## Project Commands

```bash
npm run dev           # Start development server (http://localhost:3000)
npm run build         # TypeScript compile + Next.js build
npm run test          # Vitest unit tests
npm run lint          # ESLint check
npx supabase start    # Start local Supabase (requires Docker)
npx supabase db push  # Apply migrations to local DB
```
