# Production Deployment Guide - TripGenius AI

This document provides step-by-step instructions for deploying TripGenius AI to production using **Vercel** (for the frontend and API routes) and **Supabase** (for the database and authentication).

---

## 1. Prerequisites & Provisioning

Before deploying, ensure you have active developer accounts with the following services:
1. **Supabase Cloud**: Provision a PostgreSQL database and configure authentication.
2. **Vercel**: Set up a project linked to your git repository.
3. **Google Cloud Console**: Enable both **Places API (New)** and **Maps JavaScript API**, and generate API keys.
4. **Amadeus for Developers**: Create a production application under your account to get your Client ID and Client Secret.
5. **LLM API Provider**:
   - Google AI Studio (Gemini)
   - OpenAI Platform (GPT-4o)
   - Alibaba Cloud DashScope (Qwen)

---

## 2. Supabase Production Database Setup

### Step 2.1: Run Database Migrations
Run the migrations against your production Supabase database using the Supabase CLI:
```bash
# Link your local CLI to the remote project (retrieve project ref from settings)
npx supabase link --project-ref your-supabase-project-ref

# Push the migration schema and security policies to production
npx supabase db push
```
*Note: This will execute both `001_initial_schema.sql` (schema structure) and `002_rls_and_indexes.sql` (RLS policies, triggers, and foreign key indexes).*

### Step 2.2: Verify Row Level Security (RLS)
Ensure RLS is enabled for all tables in your production SQL editor:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
*Expected: All tables must show `true` for `rowsecurity`.*

### Step 2.3: Verify User Signup Trigger
Verify that the trigger mapping is active:
```sql
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'users' AND event_object_schema = 'auth';
```

---

## 3. Vercel Production Frontend Setup

### Step 3.1: Link Repository and Import Project
1. Log in to Vercel, click **Add New** -> **Project**.
2. Select your git repository containing the TripGenius AI code.
3. Keep the default settings (Framework Preset: **Next.js**, Root Directory: `./`).

### Step 3.2: Configure Environment Variables
In your Vercel Project Dashboard -> **Settings** -> **Environment Variables**, add the following:

| Key | Value Source / Description | Tier / Expose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings -> API -> Project URL | Client-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings -> API -> `anon` public key | Client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings -> API -> `service_role` key | **Secret (Server Only)** |
| `AI_PROVIDER` | `'gemini'` \| `'openai'` \| `'qwen'` | Server Only |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio api key (if provider=gemini) | **Secret (Server Only)** |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Places (New) API Key | **Secret (Server Only)** |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Cloud Maps JavaScript API Key | Client-safe (Restrict in GCP) |
| `AMADEUS_CLIENT_ID` | Amadeus Developer Dashboard API Key | **Secret (Server Only)** |
| `AMADEUS_CLIENT_SECRET` | Amadeus Developer Dashboard API Secret | **Secret (Server Only)** |
| `NEXT_PUBLIC_APP_URL` | Your production custom domain URL (e.g. `https://tripgenius.ai`) | Client-safe |

*Optional Model Overrides (if customizing default model configurations):*
- `GEMINI_PRO_MODEL` (Default: `gemini-2.5-pro-preview-05-06`)
- `GEMINI_FLASH_MODEL` (Default: `gemini-2.5-flash-preview-05-20`)
- `GEMINI_EMBEDDING_MODEL` (Default: `text-embedding-004`)
- `OPENAI_API_KEY`, `OPENAI_PRO_MODEL`, `OPENAI_FLASH_MODEL`, `OPENAI_EMBEDDING_MODEL` (if using OpenAI)
- `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_FLASH_MODEL`, `QWEN_EMBEDDING_MODEL` (if using Qwen)

---

## 4. Pre-Deployment Readiness Checklist

Before triggering the deployment build, check off the following tasks:

- [ ] **No Committed Secrets**: Verify that no `.env`, `.env.local`, or client-side files contain plaintext secrets.
- [ ] **Client Key Restrictions**: In Google Cloud Console, restrict `NEXT_PUBLIC_GOOGLE_MAPS_KEY` using HTTP referrers restriction to allow loads ONLY from your production URL and local debugging (e.g. `localhost`).
- [ ] **Amadeus API Tier**: Check that your Amadeus API limits are adjusted and verified (test tier provides 2,000 monthly credits; upgrade if expecting higher production volume).
- [ ] **Cache TTL**: Confirm that the 14-day Places Cache TTL configuration is in place to minimize Google Places API billing.
- [ ] **Unit Tests passing**: Verify that all test suites compile and pass successfully by running `npm run test`.
- [ ] **TypeScript compiles**: Run `npx tsc --noEmit` locally with no errors.
- [ ] **Linter passing**: Run `npm run lint` locally with no warnings or errors.

---

## 5. Verification Plan (Post-Deployment)

Once Vercel finishes the build:
1. **User Sign Up**: Visit `/signup`, create an account, and verify that the trigger automatically inserts a record into the `public.users` table and creates a profile in `public.user_profiles`.
2. **Itinerary Creation**: Fill in the travel planning input and verify that a split-pane view loads with structured POIs on the left and a map on the right.
3. **Save Trip & Hotels**: Select a recommended hotel, save it, and inspect your network tab. Verify that:
   - The selected hotel is successfully written to `trip_hotels`.
   - The API response does not leak internal DB columns or raw SQL/Amadeus messages on failures.
4. **RLS Verification**: Sign in with User A, retrieve a valid trip ID from User B, and call `GET /api/trips/{userB_tripId}`. Verify that it returns `404 Not Found` or `401 Unauthorized` and denies access.

---

## 6. Rollback Procedures

If critical defects are detected in production, execute these steps immediately:

### Step 6.1: Vercel Rollback (Instant)
1. Go to your project page in the **Vercel Dashboard**.
2. Click on the **Deployments** tab.
3. Locate the last stable deployment (from a previous commit or branch build).
4. Click the **three dots** on the right side of the stable deployment card and select **Redeploy**.
5. Select **Revert** or promote the deployment to production. Vercel will instantly route 100% of traffic to that stable build.

### Step 6.2: Database Migration Rollback (Optional)
If your database schema has changed and must be rolled back, run down migrations manually or restore a database backup point:
1. In the **Supabase Dashboard**, navigate to **Database** -> **Backups**.
2. Choose a Daily Backup Point or Point-in-time recovery point prior to the release.
3. Click **Restore**. (Note: This will replace the schema and restore all tables to that timestamp).
