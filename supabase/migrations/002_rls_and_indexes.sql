-- ENABLE ROW LEVEL SECURITY
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.places enable row level security;
alter table public.trips enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.trip_hotels enable row level security;

-- POLICIES FOR USERS
drop policy if exists "Users can view their own user data" on public.users;
create policy "Users can view their own user data"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own user data" on public.users;
create policy "Users can update their own user data"
  on public.users for update
  using (auth.uid() = id);

-- POLICIES FOR USER_PROFILES
drop policy if exists "Users can view their own profile" on public.user_profiles;
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.user_profiles;
create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

-- POLICIES FOR PLACES (Global Cache)
drop policy if exists "Allow authenticated users to read places" on public.places;
create policy "Allow authenticated users to read places"
  on public.places for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated users to insert/update places" on public.places;
create policy "Allow authenticated users to insert/update places"
  on public.places for all
  to authenticated
  using (true)
  with check (true);

-- POLICIES FOR TRIPS
drop policy if exists "Users can view their own trips" on public.trips;
create policy "Users can view their own trips"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own trips" on public.trips;
create policy "Users can insert their own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own trips" on public.trips;
create policy "Users can update their own trips"
  on public.trips for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own trips" on public.trips;
create policy "Users can delete their own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- POLICIES FOR ITINERARY_DAYS
drop policy if exists "Users can view itinerary days for their own trips" on public.itinerary_days;
create policy "Users can view itinerary days for their own trips"
  on public.itinerary_days for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert itinerary days for their own trips" on public.itinerary_days;
create policy "Users can insert itinerary days for their own trips"
  on public.itinerary_days for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update itinerary days for their own trips" on public.itinerary_days;
create policy "Users can update itinerary days for their own trips"
  on public.itinerary_days for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete itinerary days for their own trips" on public.itinerary_days;
create policy "Users can delete itinerary days for their own trips"
  on public.itinerary_days for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

-- POLICIES FOR ITINERARY_ITEMS
drop policy if exists "Users can view itinerary items for their own trips" on public.itinerary_items;
create policy "Users can view itinerary items for their own trips"
  on public.itinerary_items for select
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = itinerary_items.day_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert itinerary items for their own trips" on public.itinerary_items;
create policy "Users can insert itinerary items for their own trips"
  on public.itinerary_items for insert
  with check (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = itinerary_items.day_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update itinerary items for their own trips" on public.itinerary_items;
create policy "Users can update itinerary items for their own trips"
  on public.itinerary_items for update
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = itinerary_items.day_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete itinerary items for their own trips" on public.itinerary_items;
create policy "Users can delete itinerary items for their own trips"
  on public.itinerary_items for delete
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = itinerary_items.day_id
      and trips.user_id = auth.uid()
    )
  );

-- POLICIES FOR TRIP_HOTELS
drop policy if exists "Users can view trip hotels for their own trips" on public.trip_hotels;
create policy "Users can view trip hotels for their own trips"
  on public.trip_hotels for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_hotels.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert trip hotels for their own trips" on public.trip_hotels;
create policy "Users can insert trip hotels for their own trips"
  on public.trip_hotels for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_hotels.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update trip hotels for their own trips" on public.trip_hotels;
create policy "Users can update trip hotels for their own trips"
  on public.trip_hotels for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_hotels.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete trip hotels for their own trips" on public.trip_hotels;
create policy "Users can delete trip hotels for their own trips"
  on public.trip_hotels for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_hotels.trip_id
      and trips.user_id = auth.uid()
    )
  );

-- USER PROFILE SYNCHRONIZATION TRIGGER (FOR SIGNUPS)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  
  insert into public.user_profiles (user_id, budget_tier, travel_pace)
  values (
    new.id,
    'mid-range',
    'moderate'
  )
  on conflict (user_id) do nothing;
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- PERFORMANCE INDEXES ON FOREIGN KEYS
create index if not exists idx_itinerary_days_trip_id on public.itinerary_days(trip_id);
create index if not exists idx_trip_hotels_trip_id on public.trip_hotels(trip_id);
create index if not exists idx_itinerary_items_place_id on public.itinerary_items(place_id);
