-- USERS
create table public.users (
  id            uuid references auth.users primary key,
  email         text unique not null,
  full_name     text,
  avatar_url    text,
  created_at    timestamptz default now()
);

-- USER PREFERENCE PROFILES
create table public.user_profiles (
  user_id       uuid references public.users primary key,
  budget_tier   text check (budget_tier in ('budget', 'mid-range', 'luxury')) default 'mid-range',
  travel_pace   text check (travel_pace in ('slow', 'moderate', 'fast')) default 'moderate',
  interests     text[]   default '{}',           -- e.g., ['museums', 'food', 'nature']
  interest_vec  vector(1536),                    -- OpenAI/Gemini embedding of interests
  updated_at    timestamptz default now()
);

-- PLACES CACHE (avoid repeated API calls)
create table public.places (
  place_id      text primary key,               -- Google Place ID
  name          text not null,
  category      text,                           -- 'attraction' | 'restaurant' | 'hotel'
  latitude      double precision not null,
  longitude     double precision not null,
  address       text,
  rating        numeric(2,1),
  price_level   int check (price_level between 1 and 4),
  opening_hours jsonb,                          -- { "mon": ["09:00", "18:00"], ... }
  photos        jsonb,                          -- Array of photo URLs
  summary       text,
  embedding     vector(1536),                   -- For semantic similarity queries
  last_fetched  timestamptz default now(),
  city          text,
  country       text
);

-- TRIPS (master record)
create table public.trips (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.users not null,
  title         text not null,
  destination   text not null,
  city_code     text,                           -- Amadeus city code, e.g. 'TYO'
  start_date    date not null,
  end_date      date not null,
  adults        int default 1,
  budget_tier   text,
  travel_pace   text,
  user_prompt   text,                           -- Raw user input that created this trip
  status        text default 'draft',           -- 'draft' | 'saved' | 'archived'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ITINERARY DAYS
create table public.itinerary_days (
  id            uuid default gen_random_uuid() primary key,
  trip_id       uuid references public.trips on delete cascade,
  day_number    int not null,
  date          date not null,
  notes         text
);

-- ITINERARY ITEMS (scheduled activities per day)
create table public.itinerary_items (
  id              uuid default gen_random_uuid() primary key,
  day_id          uuid references public.itinerary_days on delete cascade,
  place_id        text references public.places,
  item_type       text check (item_type in ('attraction', 'restaurant', 'hotel', 'transit')),
  start_time      time not null,
  end_time        time not null,
  duration_mins   int,
  sequence_num    int not null,                 -- Ordering index for drag-and-drop
  ai_tip          text,                         -- LLM-generated contextual tip
  transit_to_next jsonb                         -- { "mode": "walk", "duration_mins": 12 }
);

-- HOTEL RECOMMENDATIONS (per trip)
create table public.trip_hotels (
  id              uuid default gen_random_uuid() primary key,
  trip_id         uuid references public.trips on delete cascade,
  amadeus_hotel_id text,
  name            text,
  latitude        double precision,
  longitude       double precision,
  rating          numeric(2,1),
  price_per_night numeric(10,2),
  currency        text default 'USD',
  rank            int                           -- 1, 2, 3 (top picks)
);

-- INDEXES for performance
create index on public.places using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on public.places (city, category);
create index on public.itinerary_items (day_id, sequence_num);
create index on public.trips (user_id, status);
