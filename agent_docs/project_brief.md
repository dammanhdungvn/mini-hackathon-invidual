# Project Brief
## TripGenius AI

Quick reference for any AI agent starting a new task.

---

## What We Are Building

TripGenius AI is a production-ready web application that combines conversational AI with a deterministic scheduling algorithm to produce travel itineraries that are:
- **Hallucination-free** (all places are API-validated)
- **Logistically accurate** (scheduling respects opening hours and transit times)
- **Personalized** (vector similarity matching on user interests)

---

## The Core AI Insight

The single most important architectural decision is the **Hybrid AI + Deterministic Solver** pattern:

```
LLM = Language understanding + Narrative writing
Algorithm = Logical scheduling + Route optimization

The LLM never schedules. The algorithm never writes.
```

Stage 1 (LLM): "What does the user want?"
Stage 2 (DB/API): "Which real places match?"
Stage 3 (Algorithm): "What is the optimal schedule?"
Stage 4 (LLM): "How do we describe it engagingly?"

---

## Who Uses This

1. **Time-Starved Sarah** — Wants a ready-to-go 3-day plan in 2 minutes, not 2 hours.
2. **Optimization Marcus** — Wants routes that don't backtrack and venues that are actually open.

---

## MVP Boundaries

**In scope (V1):**
- Conversational travel planning input
- AI-optimized multi-day itinerary generation
- Hotel recommendations (ranked, not bookable)
- Interactive map with markers and routes
- Save, edit, and re-generate trips
- User accounts with preference profiles

**Out of scope (V2):**
- Hotel booking / payment processing
- Flight search and tracking
- Real-time collaborative editing
- Native mobile apps (iOS / Android)
- Social sharing features

---

## Key Metrics for Success

- Zero venue time-window conflicts in generated itineraries
- Itinerary skeleton loads within 3.5 seconds
- 40%+ of generated itineraries are saved by users
- Average API cost per itinerary generation under $0.08
