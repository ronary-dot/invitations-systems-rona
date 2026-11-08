-- Invitation system: initial schema
--
-- Everything is prefixed with `inv_` so the database can be shared with
-- another application. Staff access is limited to users listed in
-- `inv_staff`, not every authenticated user.
--
-- Guests never get a Supabase account. The public pages (/e/[slug] for the
-- general event link, /i/[token] for a personal invite link) go through
-- security-definer SQL functions added in stage 2.

create extension if not exists "pgcrypto";

-- ---------- helpers ----------
create or replace function public.inv_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- staff allowlist ----------
create table public.inv_staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);

create or replace function public.inv_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.inv_staff where user_id = auth.uid());
$$;

-- Onboarding: create the user in Authentication > Users, then run
--   select public.inv_add_staff('person@example.com', 'Display Name');
create or replace function public.inv_add_staff(p_email text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'No auth user with email %', p_email;
  end if;

  insert into public.inv_staff (user_id, email, display_name)
  values (v_user_id, lower(p_email), p_display_name)
  on conflict (user_id) do update
    set display_name = coalesce(excluded.display_name, public.inv_staff.display_name);

  return v_user_id;
end;
$$;

revoke all on function public.inv_add_staff(text, text) from public, anon, authenticated;

-- ---------- events ----------
create type public.inv_event_type as enum ('private', 'business');

create table public.inv_events (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title                  text not null check (char_length(title) between 1 and 200),
  event_type             public.inv_event_type not null default 'private',
  description            text,
  date_time              timestamptz not null,
  venue_name             text,
  address                text,
  lat                    double precision,
  lng                    double precision,
  template_id            text not null default 'classic',
  media_url              text,
  primary_color          text,
  gift_link_url          text,
  -- Text sent with the invitation by email / WhatsApp. Placeholders such as
  -- {name} and {link} are filled per invitee.
  invitation_message     text,
  reminder_offset_hours  integer not null default 24 check (reminder_offset_hours >= 0),
  reminder_sent_at       timestamptz,
  rsvp_deadline          timestamptz,
  max_guests             integer check (max_guests is null or max_guests > 0),
  -- The general link /e/[slug] can be closed so only personal links work.
  allow_public_link      boolean not null default true,
  is_active              boolean not null default true,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index inv_events_date_time_idx on public.inv_events (date_time);

create trigger inv_events_set_updated_at
  before update on public.inv_events
  for each row execute function public.inv_set_updated_at();

-- ---------- invitees (guest list) ----------
create type public.inv_invitee_status as enum ('pending', 'sent', 'opened', 'confirmed', 'declined');

create table public.inv_invitees (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.inv_events(id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 1 and 120),
  phone            text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),  -- E.164
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  group_name       text,
  expected_guests  integer not null default 1 check (expected_guests between 1 and 50),
  -- Personal link /i/[token]. Long and random so it cannot be guessed.
  token            text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status           public.inv_invitee_status not null default 'pending',
  first_sent_at    timestamptz,
  last_sent_at     timestamptz,
  opened_at        timestamptz,
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (phone is not null or email is not null)
);

create unique index inv_invitees_event_phone_key on public.inv_invitees (event_id, phone)
  where phone is not null;
create index inv_invitees_event_idx on public.inv_invitees (event_id);

create trigger inv_invitees_set_updated_at
  before update on public.inv_invitees
  for each row execute function public.inv_set_updated_at();

-- ---------- registrations (RSVPs) ----------
create type public.inv_registration_source as enum ('invite_link', 'public_link', 'manual');

create table public.inv_registrations (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.inv_events(id) on delete cascade,
  invitee_id   uuid references public.inv_invitees(id) on delete set null,
  full_name    text not null check (char_length(full_name) between 1 and 120),
  phone        text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),  -- E.164
  email        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  attending    boolean not null default true,
  guest_count  integer not null default 1 check (guest_count between 0 and 50),
  guest_names  jsonb not null default '[]'::jsonb,
  notes        text check (notes is null or char_length(notes) <= 1000),
  source       public.inv_registration_source not null default 'public_link',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (event_id, phone)
);

create index inv_registrations_event_idx on public.inv_registrations (event_id);
create index inv_registrations_invitee_idx on public.inv_registrations (invitee_id);

create trigger inv_registrations_set_updated_at
  before update on public.inv_registrations
  for each row execute function public.inv_set_updated_at();

-- ---------- message log (invitations, reminders, nudges) ----------
create type public.inv_message_channel as enum ('email', 'whatsapp');
create type public.inv_message_kind as enum ('invitation', 'reminder', 'nudge', 'test');
create type public.inv_message_status as enum ('sent', 'failed');

create table public.inv_message_log (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.inv_events(id) on delete cascade,
  invitee_id       uuid references public.inv_invitees(id) on delete set null,
  registration_id  uuid references public.inv_registrations(id) on delete set null,
  channel          public.inv_message_channel not null,
  kind             public.inv_message_kind not null,
  to_address       text not null,
  status           public.inv_message_status not null,
  error            text,
  created_by       uuid references auth.users(id) on delete set null,  -- null = cron
  created_at       timestamptz not null default now()
);

create index inv_message_log_event_idx on public.inv_message_log (event_id, created_at desc);

-- ---------- row level security ----------
alter table public.inv_staff enable row level security;
alter table public.inv_events enable row level security;
alter table public.inv_invitees enable row level security;
alter table public.inv_registrations enable row level security;
alter table public.inv_message_log enable row level security;

create policy "inv staff read staff"
  on public.inv_staff for select to authenticated
  using (public.inv_is_staff());

create policy "inv staff full access to events"
  on public.inv_events for all to authenticated
  using (public.inv_is_staff()) with check (public.inv_is_staff());

create policy "inv staff full access to invitees"
  on public.inv_invitees for all to authenticated
  using (public.inv_is_staff()) with check (public.inv_is_staff());

create policy "inv staff full access to registrations"
  on public.inv_registrations for all to authenticated
  using (public.inv_is_staff()) with check (public.inv_is_staff());

create policy "inv staff full access to message log"
  on public.inv_message_log for all to authenticated
  using (public.inv_is_staff()) with check (public.inv_is_staff());

-- No policies for `anon` on purpose.

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inv-event-media',
  'inv-event-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Public bucket: files are served by URL without a select policy, so no
-- one can list the bucket.
create policy "inv-event-media: staff insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'inv-event-media' and public.inv_is_staff());

create policy "inv-event-media: staff update"
  on storage.objects for update to authenticated
  using (bucket_id = 'inv-event-media' and public.inv_is_staff());

create policy "inv-event-media: staff delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'inv-event-media' and public.inv_is_staff());
