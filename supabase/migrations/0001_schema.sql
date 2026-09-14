-- ============================================================================
-- 0001_schema.sql
-- Grundschema: Vereine, Veranstaltungen, Schichten, Helfer, Anmeldungen
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- app_settings: zentrale, admin-editierbare Konfiguration (Singleton-Zeile)
-- ----------------------------------------------------------------------------
create table app_settings (
  id smallint primary key default 1,
  org_name text not null default 'Ornemer Raugeisthexen',
  logo_url text not null default '/assets/raugeisthexen-logo.jpg',
  color_primary text not null default '#111111',   -- Schwarz
  color_secondary text not null default '#c81e1e', -- Rot
  color_accent text not null default '#1f8a3b',    -- Grün
  default_capacity integer not null default 4 check (default_capacity > 0),
  notify_emails text[] not null default '{}',
  privacy_notice text not null default
    'Deine Daten werden ausschließlich zur Organisation der Helfereinsätze der Ornemer Raugeisthexen verwendet und nicht an Dritte weitergegeben.',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

-- ----------------------------------------------------------------------------
-- events: einzelne Veranstaltungen (Weltcup, Fastnacht, Hexenball, ...)
-- ----------------------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  location text,
  start_date date not null,
  end_date date not null,
  registration_deadline timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed', 'archived')),
  public_registration_enabled boolean not null default true,
  waitlist_enabled boolean not null default false,
  show_leader_public boolean not null default true,
  notify_leader_on_registration boolean not null default false,
  notify_emails text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_date_order check (end_date >= start_date)
);

create index idx_events_status on events (status);
create index idx_events_slug on events (slug);

-- ----------------------------------------------------------------------------
-- event_days: einzelne Veranstaltungstage
-- ----------------------------------------------------------------------------
create table event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  date date not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, date)
);

create index idx_event_days_event on event_days (event_id);

-- ----------------------------------------------------------------------------
-- board_members: Vorstandsmitglieder / Verantwortliche
-- ----------------------------------------------------------------------------
create table board_members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  position text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_board_members_active on board_members (active);

-- ----------------------------------------------------------------------------
-- shifts: einzelne Schichten innerhalb eines Veranstaltungstages
-- ----------------------------------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  event_day_id uuid not null references event_days (id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'open'
    check (status in ('open', 'closed', 'cancelled')),
  manually_locked boolean not null default false,
  leader_counts_as_helper boolean not null default false,
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_time_order check (end_time > start_time)
);

create index idx_shifts_event on shifts (event_id);
create index idx_shifts_event_day on shifts (event_day_id);
create index idx_shifts_status on shifts (status);

-- ----------------------------------------------------------------------------
-- shift_leaders: Zuordnung Schichtchef / weitere Verantwortliche zu Schichten
-- ----------------------------------------------------------------------------
create table shift_leaders (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts (id) on delete cascade,
  board_member_id uuid not null references board_members (id) on delete restrict,
  role text not null default 'leader' check (role in ('leader', 'support')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (shift_id, board_member_id)
);

create index idx_shift_leaders_shift on shift_leaders (shift_id);
create index idx_shift_leaders_board_member on shift_leaders (board_member_id);

-- nur ein primärer Schichtchef pro Schicht
create unique index idx_shift_leaders_one_primary
  on shift_leaders (shift_id)
  where is_primary;

-- ----------------------------------------------------------------------------
-- helpers: öffentlich angemeldete bzw. manuell angelegte Helfer
-- ----------------------------------------------------------------------------
create table helpers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  edit_token_hash text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helpers_contact_required check (
    (email is not null and length(trim(email)) > 0)
    or (phone is not null and length(trim(phone)) > 0)
  )
);

create index idx_helpers_email on helpers (lower(email));
create index idx_helpers_phone on helpers (phone);
create index idx_helpers_name on helpers (lower(last_name), lower(first_name));

-- ----------------------------------------------------------------------------
-- registrations: Zuordnung Helfer <-> Schicht
-- ----------------------------------------------------------------------------
create table registrations (
  id uuid primary key default gen_random_uuid(),
  helper_id uuid not null references helpers (id) on delete cascade,
  shift_id uuid not null references shifts (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'waitlist')),
  source text not null default 'public' check (source in ('public', 'admin')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_registrations_shift on registrations (shift_id);
create index idx_registrations_helper on registrations (helper_id);
create index idx_registrations_status on registrations (status);

-- ein Helfer darf pro Schicht nur eine aktive/wartende Anmeldung haben
create unique index idx_registrations_no_duplicate
  on registrations (helper_id, shift_id)
  where status in ('active', 'waitlist');

-- ----------------------------------------------------------------------------
-- admin_profiles: verknüpft Supabase-Auth-Benutzer mit Rollen
-- ----------------------------------------------------------------------------
create table admin_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'viewer'
    check (role in ('admin', 'viewer', 'shift_leader')),
  board_member_id uuid references board_members (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_admin_profiles_auth_user on admin_profiles (auth_user_id);

-- ----------------------------------------------------------------------------
-- audit_logs: Protokoll wichtiger Adminaktionen
-- ----------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on audit_logs (created_at desc);
create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);

insert into app_settings (id) values (1);
