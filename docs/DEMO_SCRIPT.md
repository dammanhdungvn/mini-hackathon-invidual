# Hackathon Demo Guide & Script - TripGenius AI

This guide contains a structured **5-minute live demo script** to showcase TripGenius AI. It covers both the **Happy Path** (showing full generation, scheduling, hotel matching, and manual edits) and the **Error Path** (showing input validation, uncertainty, and API resilience).

---

## Demo Overview (5 Minutes)

- **0:00 - 1:00**: Project Intro & Concept (Relational Constraint Routing + AI Synthesis)
- **1:00 - 2:30**: Happy Path: Creating a Trip to Phu Quoc via AI generation
- **2:30 - 3:45**: Plan Customization: Manual edits, day regeneration, and hotel swap
- **3:45 - 4:30**: Resilience & Error Paths: Validation and API Fallbacks
- **4:30 - 5:00**: Summary & Architecture Highlights

---

## Step-by-Step Click Sequence

### Part 1: Landing on the Dashboard
1. Log in to the application and arrive at the dashboard `/dashboard`.
2. *Script Highlight:* 
   > *"Welcome to TripGenius AI. Normally, travel planning involves hours of cross-referencing maps, opening hours, and hotel listings. TripGenius eliminates this by combining natural language AI with a pure mathematical schedule optimizer. Let's build a new trip."*
3. Click on **Start Planning Demo** (the engaging empty state CTA). You will land on `/plan/new`.

---

### Part 2: Itinerary Generation (Happy Path)
1. In the **New Trip Form**, click the **Phu Quoc Explorer** preset button. This will populate the prompt box with:
   `3 days in Phu Quoc. I want to visit beautiful beaches, try local seafood, and experience nature at a moderate pace with a mid-range budget.`
2. Click **Generate Itinerary**.
3. *Observe:* 
   - A beautiful glassmorphic loader screen will activate.
   - The loader displays a real-time progress track tracking the **4-stage AI pipeline**:
     1. Stage 1: AI Intent Parsing & Constraint Extraction
     2. Stage 2: Retrieving Candidate Places & Live Hotel Data
     3. Stage 3: Optimizing Route via TSPTW Mathematical Solver
     4. Stage 4: LLM Synthesizing Contextual Tips & Narratives
4. Upon completion, you will be redirected to the planning workspace `/plan/[tripId]`.
5. *Script Highlight:*
   > *"In under 3 seconds, TripGenius has analyzed our prompt, retrieved candidate places from Google, fetched real-time hotel pricing from Amadeus, built a deterministic conflict-free schedule, and had the AI write custom local tips for every single slot. Notice how items are grouped by Day, and sorted chronologically."*

---

### Part 3: Interactive Itinerary Editing
1. Scroll down the daily schedule columns. Show the custom categories (blue for attraction, purple for restaurant, green for transit).
2. **Edit Activity Time/Duration:**
   - Click the **Edit (pencil)** icon on any activity card (e.g. *VinWonders Phu Quoc*).
   - In the edit panel, change the start time or add a custom travel note. Click **Save**.
   - *Observe:* The changes are applied immediately, recalculating the end time and updating the card layout.
3. **Remove Activity & Resequence:**
   - Click the **Delete (trash)** icon on an activity.
   - *Observe:* The activity is removed, and the remaining sibling cards automatically shift up and adjust sequence numbers.
4. **Regenerate Single Day:**
   - Click **Regenerate Day** on a day column.
   - *Observe:* The button changes to a pulsing state. The page fetches new attraction candidates and updates the schedule for that day only, keeping other days intact.

---

### Part 4: Hotel Recommendations
1. Click the selected hotel badge at the top of a day column to highlight it.
2. *Script Highlight:*
   > *"We don't just schedule attractions; we align them geospatially with hotels. TripGenius retrieved candidate hotels matching our budget tier, calculated their distance to the activity centroid, and selected the top 3 options with AI reasons explaining why each fits."*

---

### Part 5: Error Paths & Safety
To demonstrate the application's resilience, return to `/plan/new` (or the home page) and test the remaining presets:
1. **Triggering Input Validation Error:**
   - Click the **Validation Error** preset (populates `"Phu Quoc"`).
   - Click **Generate Itinerary**.
   - *Observe:* The form blocks submission and displays a clear yellow alert: *"Please enter a longer prompt (minimum 5 characters)."*
2. **Triggering AI Uncertainty / Parsing Error:**
   - Enter a prompt with invalid details (e.g., `"something somewhere"` or click a vague template if customized).
   - Click **Generate Itinerary**.
   - *Observe:* The system handles parsing failure cleanly, returning a structured clarifying error: *"I couldn't extract a valid destination, duration, or dates from your request. Please specify where you want to go..."*
3. **Triggering External API Fallbacks:**
   - If Google Cloud or Amadeus API credentials are invalid or reach query limits, the backend doesn't crash. It seamlessly falls back to pre-seeded mock candidate data, allowing the TSPTW routing and narrative generator to execute without interruptions.

---

## Technical Fallback Plan

In case of live connection issues:
- **Fallback 1 (DB / Supabase Down)**: If database commits fail, show a previously saved trip on your dashboard, which has RLS and indexes configured to run locally.
- **Fallback 2 (API/Network Timeout)**: If the Gemini or Google API experiences high latency, you can toggle the `AI_PROVIDER` to `qwen` or `openai` in the `.env.local` file without altering any core scheduling, recommending, or component logic.
