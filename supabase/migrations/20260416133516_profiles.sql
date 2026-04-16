-- =============================================================
-- profiles
-- Public mirror of auth.users so we can query display name / email
-- without touching the auth schema. Populated by a trigger on
-- auth.users insert; users cannot insert directly.
-- =============================================================

create table profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  email        text        not null,
  display_name text,
  updated_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

-- Authenticated users may read + update only their own profile row.
-- Inserts are driven by the handle_new_user trigger below; no insert policy
-- means user-initiated inserts are denied.

create policy profiles_select_self on profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_self on profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- =============================================================
-- handle_new_user
-- Trigger function that mirrors a new auth.users row into profiles.
-- SECURITY DEFINER so it runs with owner privileges regardless of the
-- role performing the insert (Supabase Auth inserts via the auth role).
-- =============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
