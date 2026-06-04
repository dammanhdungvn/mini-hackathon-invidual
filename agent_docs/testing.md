# Testing Guide
## TripGenius AI

---

## Test Runner

We use **Vitest** for all unit and integration tests.

```bash
npm run test          # Run all tests once
npm run test:watch    # Watch mode during development
npm run test:coverage # Coverage report
```

---

## What To Test

### Critical (must have tests)

| File | What to test |
|---|---|
| `lib/solver/tsptw.ts` | Scheduling algorithm correctness |
| `lib/solver/scorer.ts` | Hotel scoring formula |
| `lib/solver/haversine.ts` | Distance calculation accuracy |
| `lib/ai/parser.ts` | Intent parsing with mock LLM responses |
| `lib/services/google-places.ts` | Cache TTL logic (serve from cache vs fetch) |

### Nice to have

| File | What to test |
|---|---|
| `lib/ai/synthesizer.ts` | Does not add place names to locked schedule |
| API routes | Auth rejection on missing session |

---

## Test File Locations

Place test files adjacent to source files:
```
lib/solver/tsptw.ts
lib/solver/tsptw.test.ts   ← co-located
```

---

## Required Test Cases for `tsptw.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { buildSchedule } from './tsptw'
import type { CandidatePlace } from '@/lib/types/place'

describe('buildSchedule', () => {
  it('returns empty schedule for empty input', () => {
    expect(buildSchedule([], { pace: 'moderate', startDate: '2026-07-10' })).toEqual([])
  })

  it('schedules a single place correctly', () => {
    const input: CandidatePlace[] = [mockAttraction({ openTime: '09:00', closeTime: '18:00' })]
    const result = buildSchedule(input, { pace: 'moderate', startDate: '2026-07-10' })
    expect(result).toHaveLength(1)
    expect(result[0].startTime >= '09:00').toBe(true)
    expect(result[0].endTime <= '18:00').toBe(true)
  })

  it('produces no time-window conflicts with valid candidates', () => {
    const places = mockAttractionList(5) // 5 attractions, no conflicts
    const schedule = buildSchedule(places, { pace: 'moderate', startDate: '2026-07-10' })
    
    for (let i = 1; i < schedule.length; i++) {
      // Each item must start after previous item ends (+ transit time)
      expect(schedule[i].startTime >= schedule[i-1].endTime).toBe(true)
    }
  })

  it('returns conflict error for impossible time windows', () => {
    // Place A closes at 10:00 and Place B opens at 20:00 with 6h duration each
    const impossible = [
      mockAttraction({ openTime: '08:00', closeTime: '10:00', durationMins: 360 }),
      mockAttraction({ openTime: '20:00', closeTime: '22:00', durationMins: 360 }),
    ]
    const result = buildSchedule(impossible, { pace: 'fast', startDate: '2026-07-10' })
    // Should still produce what it can, flagging the impossible item
    expect(result.some(item => item.conflict === true)).toBe(true)
  })
})
```

---

## Required Test Cases for `scorer.ts`

```typescript
describe('scoreHotel', () => {
  it('prefers higher-rated hotel within same price range', () => {
    const hotelA = mockHotel({ rating: 4.8, pricePerNight: 150, distKm: 1.2 })
    const hotelB = mockHotel({ rating: 3.9, pricePerNight: 150, distKm: 1.2 })
    expect(scoreHotel(hotelA, targetPrice) > scoreHotel(hotelB, targetPrice)).toBe(true)
  })

  it('penalizes hotels far from target price', () => {
    const budgetHotel = mockHotel({ rating: 4.0, pricePerNight: 80, distKm: 1.0 })
    const overBudgetHotel = mockHotel({ rating: 4.0, pricePerNight: 500, distKm: 1.0 })
    const targetPrice = 100 // user wants $100/night
    expect(scoreHotel(budgetHotel, targetPrice) > scoreHotel(overBudgetHotel, targetPrice)).toBe(true)
  })
})
```

---

## Mocking External Services

Always mock external APIs in tests:

```typescript
import { vi } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockPlace, error: null }) })),
  }),
}))

// Mock Google Generative AI
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'mock-model'),
}))
```
