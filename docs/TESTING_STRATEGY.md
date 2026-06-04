# Testing Strategy
## TripGenius AI

> **Last Updated:** 2026-06-04
> **Test Runner:** Vitest (`npm run test`)
> **Coverage:** `npm run test:coverage`

---

## 1. Testing Philosophy

TripGenius follows **Test-Driven Development (TDD)** for all business logic.

**Rule:** Tests are written *before* or *alongside* the implementation for:
- All solver functions (pure TypeScript — easy to unit test)
- All scoring functions
- The recommendation engine (integration test with mocked services)

**LLM-calling modules** (`parser.ts`, `synthesizer.ts`) are tested via integration tests with mocked AI SDK responses, not live calls.

---

## 2. Test File Locations

| Test File | Module Under Test | Type |
|---|---|---|
| `src/lib/solver/haversine.test.ts` | `lib/solver/haversine.ts` | Unit |
| `src/lib/solver/scorer.test.ts` | `lib/solver/scorer.ts` | Unit |
| `src/lib/solver/tsptw.test.ts` | `lib/solver/tsptw.ts` | Unit |
| `src/lib/solver/hotel-scorer.test.ts` | `lib/solver/scorer.ts` (hotel functions) | Unit |
| `src/lib/services/recommendations.test.ts` | `lib/services/recommendations.ts` | Integration (mocked) |
| `src/lib/services/hotel-recommendations.test.ts` | `lib/services/hotel-recommendations.ts` | Integration (mocked) |
| `src/lib/itinerary/operations.test.ts` | `lib/itinerary/operations.ts` | Unit (59 tests) |

---

## 3. Required Test Cases by Module

### haversine.ts
- ✅ Returns 0 for identical coordinates
- ✅ Tokyo–Osaka distance ~400 km
- ✅ Short walking distance correct
- ✅ A→B equals B→A (symmetry)
- ✅ Walking speed for ≤1.5 km
- ✅ Taxi speed for 1.5–10 km
- ✅ Express for >10 km

### scorer.ts
- ✅ `scoreHotel`: returns 0–1, penalises over-budget, handles missing data
- ✅ `scorePlace`: 0–1 range, high-rated+similar scores high, nearby > distant
- ✅ `scoreOpeningHourFit`: fully inside = 1.0, closed day = 0.0, unknown = 0.5, partial overlap
- ✅ `rankPlaces`: sorted descending, respects topN, non-mutating

### tsptw.ts
- ✅ Empty input → empty output, no conflicts
- ✅ Single place scheduled correctly
- ✅ No duplicate place IDs in output
- ✅ Times in HH:MM format
- ✅ Sequence numbers are non-negative integers
- ✅ Deterministic: same input → same output

### recommendations.ts (mocked)
- ✅ Returns CandidatePlace array
- ✅ Sorted by score (highest first)
- ✅ All results originate from places service (LLM does not create places)
- ✅ Respects topN limit
- ✅ Returns empty array when no candidates
- ✅ Filters by minRating
- ✅ Calls searchPlacesNearby with correct destination

---

## 4. Mocking Strategy

External dependencies are mocked at the module level using `vi.mock()`:

```typescript
// Mock Google Places service (no HTTP calls in tests)
vi.mock('@/lib/services/google-places', () => ({
  searchPlacesNearby: vi.fn(),
}))

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({ ... })),
}))
```

**Never mock:** `haversine.ts`, `scorer.ts`, `tsptw.ts` — these are pure functions.

---

## 5. Running Tests

```bash
# Run all tests once
npm run test

# Watch mode (re-runs on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 6. CI Requirements

All PRs must pass:
```
npm run test       # all tests green
npm run lint       # no ESLint errors
npx tsc --noEmit   # no TypeScript errors
```
