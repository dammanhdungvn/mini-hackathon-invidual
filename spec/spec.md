# TripGenius AI - Product Specification

**Target Output File:** `spec/spec.md`  
**Framework:** AI Product Canvas

---

## 1. Problem Evidence

### User Pain Points
* **Information Overload:** Planning travel manually requires aggregating and cross-referencing information across multiple platforms (e.g., Google Maps, TripAdvisor, Booking.com, local venue websites).
* **Friction in Logistics:** Coordinating opening hours, distance between venues, and transit times with personal budget constraints requires significant manual effort and time.

### Travel Planning Problems with Current AI
* **Hallucinations:** Existing LLM chatbots often output itineraries that include permanently closed venues, impossible transit times, and fabricated hotels.
* **Lack of Trust:** Because users cannot trust the AI's logistics, they end up verifying every recommendation manually, defeating the purpose of the AI assistant.

### Assumptions
* Travelers want highly personalized, constraint-aware itineraries without spending 10+ hours researching.
* An AI assistant can solve this *only* if its natural language understanding is grounded in real-time, deterministic data (Google Places, Amadeus) and mathematical scheduling constraints (TSPTW solver).

---

## 2. Product Slice

To prove value quickly, the MVP focuses on a narrow, high-impact slice of the user journey:

* **One User:** Sarah, "The Time-Starved Planner" (wants a personalized 3-day trip without doing the research).
* **One Job:** Generate a geographically and temporally optimized daily schedule using validated locations.
* **One AI Decision:** Translating a natural language prompt ("I want a relaxed weekend with history and sushi") into structured search constraints and synthesizing a personalized contextual narrative for the final locked schedule.
* **One Output:** An interactive, 3-day itinerary with an integrated map, venue details, and hotel recommendations that the user can tweak via drag-and-drop.

---

## 3. AI Product Canvas

### Value
* **Who is the user?** Time-starved professionals and optimization enthusiasts who want the best route without the planning headache.
* **What pain does AI solve?** It eliminates the friction of matching personal preferences to valid locations, checking opening hours, routing geographically, and calculating distances.

### Trust
* **What happens when AI is wrong?** If an LLM misinterprets an intent or a scheduling conflict arises, the UI provides clear warnings.
* **How can the user edit/recover?** The user is never locked in. They can use the Itinerary Editor to drag-and-drop activities, click "Swap Attraction" to fetch the next-best deterministic option, or adjust preferences and regenerate.

### Feasibility
* **API Cost:** Capped at ~$0.08 per successful itinerary generation by leveraging a 14-day Postgres database cache for Google Places and using Gemini 2.5 Pro (for parsing) and Gemini 2.5 Flash (for synthesis).
* **Latency:** Initial skeleton renders in <3.5s; narrative text streams in real-time.
* **Data Dependency:** Relies on Google Places API (for coordinates/hours) and Amadeus API (for hotels).
* **Risks:** Upstream API rate limits, external API downtime, and LLM schema validation failures.

### Learning Signal
* **How user corrections improve future recommendations:** By tracking which swapped attractions users keep versus discard, we can continuously refine our semantic embeddings and the weights in our scoring algorithm (e.g., if users frequently swap out museums on rainy days, the scoring function can be adjusted to account for weather context in V2).

---

## 4. Augment vs Automate

**Philosophy: AI assists the user; the user keeps the final decision.**

We do not fully *automate* travel planning by booking non-refundable tickets or locking users into rigid schedules. Instead, we *augment* the user's ability to plan by doing the heavy lifting of data aggregation, filtering, and constraint solving. 

The AI proposes a highly optimized "first draft." The user remains in the driver's seat, able to edit, swap, reorder, and finalize the plan through an intuitive, drag-and-drop graphical interface.

---

## 5. Failure Modes & Recovery

| Failure Mode | Mitigation & Recovery |
|---|---|
| **Hallucinated Places** | **Validation:** The LLM is restricted from generating places. It only parses intent and annotates a locked schedule. All places are deterministically fetched from the Google Places / Amadeus cache. |
| **Unavailable API Data** | **Trusted APIs:** Handled gracefully via the local `places` cache (14-day TTL). If Google/Amadeus APIs are down, the system serves cached places or displays a friendly error allowing the user to try a different query. |
| **Unclear User Intent** | **Recovery:** If the LLM cannot parse the user's raw text into a valid JSON schema (due to garbage input or ambiguity), the system catches the error, defaults to a general exploration template, and asks the user to clarify using structured UI dropdowns. |
| **Scheduling Conflicts** | **Itinerary Editor:** If a user manually drags an item to a time when it is closed, the UI flags the conflict visually but allows the user to decide how to proceed. |

---

## 6. Demo Test Cases

### Happy Case (The "Wow" Moment)
* **Input:** User enters Destination: "Tokyo", Dates: "Oct 10 - Oct 12", Budget: "Mid-range", Prompt: "I love historic temples, amazing sushi, and want a relaxed pace."
* **Expected Output:** The system instantly parses the intent, retrieves valid places from the DB/APIs, builds a conflict-free TSPTW schedule, and streams a personalized narrative. The UI populates a map with pins, a list of 3 curated hotels, and a 3-day itinerary featuring shrines and sushi spots correctly ordered by distance and opening hours.

### Hard / Error Case (Resilience Check)
* **Input:** User enters absolute gibberish for the prompt ("asdfg hjkl"), or requests a city with no cached data while the Google Places API is simulated to fail.
* **Expected Output:** The AI parsing stage catches the invalid input via Zod validation. Instead of crashing, the UI displays a graceful error message ("We couldn't quite understand that request") and falls back to a clean state, offering standard preset templates (e.g., "Classic Highlights", "Foodie Tour") so the demo can proceed smoothly.
