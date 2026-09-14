-- ============================================================================
-- KOMPLETTES DATENBANK-SETUP (einmalig) - Ornemer Raugeisthexen Helfereinteilung
-- Diese Datei fasst alle Migrationen (supabase/migrations/0001-0008) sowie die
-- Seed-Daten (supabase/seed.sql) zusammen, damit sie in EINEM Rutsch im
-- Supabase SQL Editor ausgefuehrt werden koennen.
--
-- Fuer die laufende Weiterentwicklung bleiben die einzelnen Dateien unter
-- supabase/migrations/ die massgebliche Quelle (z.B. fuer 'supabase db push').
-- ============================================================================


-- ############################################################################
-- ## Datei: supabase/migrations/0001_schema.sql
-- ############################################################################
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
  logo_url text not null default '/assets/raugeisthexen-logo.svg',
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


-- ############################################################################
-- ## Datei: supabase/migrations/0002_functions_triggers.sql
-- ############################################################################
-- ============================================================================
-- 0002_functions_triggers.sql
-- Hilfsfunktionen, updated_at-Trigger und die zentrale Kapazitätsprüfung
-- ============================================================================

-- ----------------------------------------------------------------------------
-- generic updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_events_updated_at before update on events
  for each row execute function set_updated_at();
create trigger trg_shifts_updated_at before update on shifts
  for each row execute function set_updated_at();
create trigger trg_board_members_updated_at before update on board_members
  for each row execute function set_updated_at();
create trigger trg_helpers_updated_at before update on helpers
  for each row execute function set_updated_at();
create trigger trg_registrations_updated_at before update on registrations
  for each row execute function set_updated_at();
create trigger trg_admin_profiles_updated_at before update on admin_profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- is_admin() / is_admin_or_viewer(): Rollenprüfung für RLS-Policies
--
-- current_admin_role() ist bewusst SECURITY DEFINER: Da diese Funktion
-- innerhalb der RLS-Policies von admin_profiles selbst verwendet wird
-- (siehe 0003_rls.sql), würde eine normale (invoker-seitige) Funktion beim
-- eigenen internen SELECT auf admin_profiles erneut dessen RLS-Policies
-- auswerten und damit sich selbst rekursiv aufrufen. SECURITY DEFINER
-- umgeht dieses Henne-Ei-Problem sicher, weil die Funktion ausschließlich
-- die Rolle des aktuell angemeldeten Benutzers (auth.uid()) zurückgibt und
-- keinerlei von außen beeinflussbaren Filter entgegennimmt - sie kann also
-- nicht zum Auslesen fremder Zeilen missbraucht werden.
-- ----------------------------------------------------------------------------
create or replace function current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from admin_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select current_admin_role() = 'admin';
$$;

create or replace function is_admin_or_viewer()
returns boolean
language sql
stable
as $$
  select current_admin_role() in ('admin', 'viewer');
$$;

-- ----------------------------------------------------------------------------
-- shift_effective_capacity(shift_id): tatsächlich buchbare Helferplätze.
-- Wenn "leader_counts_as_helper" aktiv ist UND ein primärer Schichtchef
-- zugeordnet ist, belegt dieser einen der regulären Plätze.
-- ----------------------------------------------------------------------------
create or replace function shift_effective_capacity(p_shift_id uuid)
returns integer
language sql
stable
as $$
  select greatest(
    0,
    s.capacity - case
      when s.leader_counts_as_helper
        and exists (
          select 1 from shift_leaders sl
          where sl.shift_id = s.id and sl.is_primary
        )
      then 1
      else 0
    end
  )
  from shifts s
  where s.id = p_shift_id;
$$;

-- ----------------------------------------------------------------------------
-- shift_active_count(shift_id): Anzahl aktiver (nicht stornierter,
-- nicht wartender) Anmeldungen
-- ----------------------------------------------------------------------------
create or replace function shift_active_count(p_shift_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::int from registrations
  where shift_id = p_shift_id and status = 'active';
$$;

-- ----------------------------------------------------------------------------
-- enforce_registration_capacity(): zentrale, transaktionssichere
-- Kapazitätsprüfung. Läuft für JEDEN Insert/Update auf registrations,
-- unabhängig davon ob über RPC oder direkt (Admin) ausgelöst.
--
-- Sperrt die betroffene Schicht-Zeile (FOR UPDATE), damit parallele
-- Buchungen serialisiert werden und niemals mehr aktive Anmeldungen
-- als die effektive Kapazität entstehen können.
-- ----------------------------------------------------------------------------
create or replace function enforce_registration_capacity()
returns trigger
language plpgsql
as $$
declare
  v_shift shifts%rowtype;
  v_effective_capacity integer;
  v_active_count integer;
  v_waitlist_enabled boolean;
begin
  -- Stornierungen und reine Wartelisten-Einträge lösen keine Kapazitätsprüfung aus
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' then
    -- bereits aktiv, keine Kapazitätsänderung
    return new;
  end if;

  -- Schicht-Zeile sperren -> serialisiert konkurrierende Buchungen
  select * into v_shift from shifts where id = new.shift_id for update;

  if v_shift.id is null then
    raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_shift.status <> 'open' or v_shift.manually_locked then
    raise exception 'SHIFT_CLOSED' using errcode = 'P0003';
  end if;

  select waitlist_enabled into v_waitlist_enabled
  from events where id = v_shift.event_id;

  v_effective_capacity := shift_effective_capacity(v_shift.id);
  v_active_count := shift_active_count(v_shift.id);

  if v_active_count >= v_effective_capacity then
    if v_waitlist_enabled then
      new.status := 'waitlist';
    else
      raise exception 'SHIFT_FULL' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_registrations_capacity
  before insert or update on registrations
  for each row execute function enforce_registration_capacity();

-- ----------------------------------------------------------------------------
-- log_audit(): einfache Hilfsfunktion zum Schreiben eines Audit-Log-Eintrags
-- ----------------------------------------------------------------------------
create or replace function log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nur echte Admins dürfen Einträge schreiben (verhindert, dass ein
  -- beliebiger authentifizierter Benutzer diese Funktion direkt aufruft
  -- und das Audit-Log mit beliebigen Einträgen füllt).
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
end;
$$;

grant execute on function log_audit(text, text, uuid, jsonb) to authenticated;


-- ############################################################################
-- ## Datei: supabase/migrations/0003_rls.sql
-- ############################################################################
-- ============================================================================
-- 0003_rls.sql
-- Row Level Security für alle Tabellen.
--
-- Grundprinzip:
--   - Öffentliche (anonyme) Nutzer erhalten NIEMALS direkten Lesezugriff auf
--     personenbezogene Daten (helpers, registrations, board_members, ...).
--   - Öffentliche Daten (Belegungsstatus, Vereinseinstellungen) werden
--     ausschließlich über die sichere View "public_shift_status" bzw. über
--     security-definer RPC-Funktionen bereitgestellt (siehe 0004 / 0005).
--   - Admins (role = 'admin') dürfen verwalten, Viewer (role = 'viewer')
--     dürfen nur lesen.
-- ============================================================================

alter table app_settings enable row level security;
alter table events enable row level security;
alter table event_days enable row level security;
alter table board_members enable row level security;
alter table shifts enable row level security;
alter table shift_leaders enable row level security;
alter table helpers enable row level security;
alter table registrations enable row level security;
alter table admin_profiles enable row level security;
alter table audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- app_settings: unkritisch (Name/Logo/Farben) -> öffentlich lesbar
-- ----------------------------------------------------------------------------
create policy app_settings_public_read on app_settings
  for select using (true);

create policy app_settings_admin_write on app_settings
  for update using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- events: öffentlich nur aktive/geschlossene Veranstaltungen sichtbar
-- ----------------------------------------------------------------------------
create policy events_public_read on events
  for select using (status in ('active', 'closed'));

create policy events_admin_read on events
  for select using (is_admin_or_viewer());

create policy events_admin_write on events
  for insert with check (is_admin());
create policy events_admin_update on events
  for update using (is_admin()) with check (is_admin());
create policy events_admin_delete on events
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- event_days: keine direkte öffentliche Sicht (läuft über public_shift_status)
-- ----------------------------------------------------------------------------
create policy event_days_admin_read on event_days
  for select using (is_admin_or_viewer());
create policy event_days_admin_write on event_days
  for insert with check (is_admin());
create policy event_days_admin_update on event_days
  for update using (is_admin()) with check (is_admin());
create policy event_days_admin_delete on event_days
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- board_members: keine öffentliche Sicht (Kontaktdaten)
-- ----------------------------------------------------------------------------
create policy board_members_admin_read on board_members
  for select using (is_admin_or_viewer());
create policy board_members_admin_write on board_members
  for insert with check (is_admin());
create policy board_members_admin_update on board_members
  for update using (is_admin()) with check (is_admin());
create policy board_members_admin_delete on board_members
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- shifts: keine direkte öffentliche Sicht (läuft über public_shift_status,
-- da sonst z.B. interne Bemerkungen ("notes") öffentlich lesbar wären)
-- ----------------------------------------------------------------------------
create policy shifts_admin_read on shifts
  for select using (is_admin_or_viewer());
create policy shifts_admin_write on shifts
  for insert with check (is_admin());
create policy shifts_admin_update on shifts
  for update using (is_admin()) with check (is_admin());
create policy shifts_admin_delete on shifts
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- shift_leaders: keine öffentliche Sicht (Namen/Zuordnung nur intern,
-- öffentlicher Vorname des Schichtchefs kommt separat über die View)
-- ----------------------------------------------------------------------------
create policy shift_leaders_admin_read on shift_leaders
  for select using (is_admin_or_viewer());
create policy shift_leaders_admin_write on shift_leaders
  for insert with check (is_admin());
create policy shift_leaders_admin_update on shift_leaders
  for update using (is_admin()) with check (is_admin());
create policy shift_leaders_admin_delete on shift_leaders
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- helpers: NIEMALS öffentlich lesbar. Zugriff für Helfer selbst ausschließlich
-- über security-definer RPCs mit Edit-Token-Prüfung (0005_booking_rpc.sql).
-- ----------------------------------------------------------------------------
create policy helpers_admin_read on helpers
  for select using (is_admin_or_viewer());
create policy helpers_admin_write on helpers
  for insert with check (is_admin());
create policy helpers_admin_update on helpers
  for update using (is_admin()) with check (is_admin());
create policy helpers_admin_delete on helpers
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- registrations: NIEMALS öffentlich lesbar.
-- ----------------------------------------------------------------------------
create policy registrations_admin_read on registrations
  for select using (is_admin_or_viewer());
create policy registrations_admin_write on registrations
  for insert with check (is_admin());
create policy registrations_admin_update on registrations
  for update using (is_admin()) with check (is_admin());
create policy registrations_admin_delete on registrations
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- admin_profiles: jeder eingeloggte Benutzer darf sein EIGENES Profil lesen
-- (wird von current_admin_role() benötigt); Verwaltung nur durch Admins.
-- ----------------------------------------------------------------------------
create policy admin_profiles_self_read on admin_profiles
  for select using (auth_user_id = auth.uid());
create policy admin_profiles_admin_read on admin_profiles
  for select using (is_admin());
create policy admin_profiles_admin_write on admin_profiles
  for insert with check (is_admin());
create policy admin_profiles_admin_update on admin_profiles
  for update using (is_admin()) with check (is_admin());
create policy admin_profiles_admin_delete on admin_profiles
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- audit_logs: nur für Admins sichtbar, Einträge werden ausschließlich über
-- log_audit() (security definer) bzw. RPCs geschrieben.
-- ----------------------------------------------------------------------------
create policy audit_logs_admin_read on audit_logs
  for select using (is_admin());


-- ############################################################################
-- ## Datei: supabase/migrations/0004_public_view.sql
-- ############################################################################
-- ============================================================================
-- 0004_public_view.sql
-- Öffentliche, sichere Sicht auf den Belegungsstatus von Schichten.
--
-- Diese View läuft (Postgres-Standardverhalten für Views ohne
-- "security_invoker") mit den Rechten des Besitzers (Migrationsrolle),
-- wodurch RLS auf den zugrundeliegenden Tabellen für den Zugriff über
-- diese View umgangen wird. Sie liefert deshalb BEWUSST ausschließlich
-- aggregierte, nicht-personenbezogene Daten. Es werden keine Helfernamen,
-- keine Kontaktdaten und keine internen Bemerkungen ausgegeben.
-- ============================================================================

create view public_shift_status
with (security_barrier = true)
as
select
  s.id as shift_id,
  s.event_id,
  s.event_day_id,
  d.date,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.display_order,
  s.status,
  s.capacity,
  shift_effective_capacity(s.id) as effective_capacity,
  shift_active_count(s.id) as active_count,
  greatest(0, shift_effective_capacity(s.id) - shift_active_count(s.id)) as available_count,
  (shift_active_count(s.id) >= shift_effective_capacity(s.id)) as is_full,
  s.manually_locked,
  e.waitlist_enabled,
  case
    when e.show_leader_public then (
      select bm.first_name || coalesce(' (' || bm.position || ')', '')
      from shift_leaders sl
      join board_members bm on bm.id = sl.board_member_id
      where sl.shift_id = s.id and sl.is_primary
      limit 1
    )
    else null
  end as leader_public_name
from shifts s
join event_days d on d.id = s.event_day_id
join events e on e.id = s.event_id
where e.status in ('active', 'closed')
  and e.public_registration_enabled = true;

grant select on public_shift_status to anon, authenticated;

comment on view public_shift_status is
  'Öffentliche, aggregierte Belegungsübersicht ohne personenbezogene Daten. '
  'Absichtlich security-definer-artig (Owner-Rechte), um RLS auf shifts/'
  'registrations kontrolliert zu umgehen, siehe Kommentar oben.';


-- ############################################################################
-- ## Datei: supabase/migrations/0005_booking_rpc.sql
-- ############################################################################
-- ============================================================================
-- 0005_booking_rpc.sql
-- Transaktionssichere, öffentlich aufrufbare Buchungsfunktionen.
--
-- Alle Funktionen sind SECURITY DEFINER mit fest gesetztem search_path,
-- damit sie unabhängig von RLS korrekt arbeiten können, prüfen aber intern
-- alle notwendigen Bedingungen selbst (Deadline, Status, Kapazität über den
-- Trigger enforce_registration_capacity). Sie geben ausschließlich Daten des
-- jeweils per Edit-Token identifizierten Helfers zurück - nie fremde Daten.
-- ============================================================================

create or replace function hash_edit_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

create or replace function generate_edit_token()
returns text
language sql
volatile
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

-- ----------------------------------------------------------------------------
-- helper: prüft ob eine Veranstaltung aktuell öffentlich buchbar ist
-- ----------------------------------------------------------------------------
create or replace function event_is_open_for_registration(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select
    e.status = 'active'
    and e.public_registration_enabled
    and (e.registration_deadline is null or e.registration_deadline > now())
  from events e
  where e.id = p_event_id;
$$;

-- ----------------------------------------------------------------------------
-- register_helper: Neuanmeldung eines Helfers für eine oder mehrere Schichten
-- ----------------------------------------------------------------------------
create or replace function register_helper(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_shift_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_token text;
  v_shift_id uuid;
  v_event_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_reg_id uuid;
  v_status text;
begin
  if p_first_name is null or length(trim(p_first_name)) = 0
     or p_last_name is null or length(trim(p_last_name)) = 0 then
    raise exception 'MISSING_NAME' using errcode = 'P0010';
  end if;

  if (p_email is null or length(trim(p_email)) = 0)
     and (p_phone is null or length(trim(p_phone)) = 0) then
    raise exception 'MISSING_CONTACT' using errcode = 'P0011';
  end if;

  if p_shift_ids is null or array_length(p_shift_ids, 1) is null then
    raise exception 'NO_SHIFTS_SELECTED' using errcode = 'P0012';
  end if;

  v_token := generate_edit_token();

  insert into helpers (first_name, last_name, email, phone, notes, edit_token_hash)
  values (
    trim(p_first_name), trim(p_last_name),
    nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    nullif(trim(p_notes), ''), hash_edit_token(v_token)
  )
  returning id into v_helper_id;

  foreach v_shift_id in array p_shift_ids loop
    begin
      select event_id into v_event_id from shifts where id = v_shift_id;

      if v_event_id is null then
        v_result := v_result || jsonb_build_object(
          'shift_id', v_shift_id, 'status', 'not_found'
        );
        continue;
      end if;

      if not event_is_open_for_registration(v_event_id) then
        v_result := v_result || jsonb_build_object(
          'shift_id', v_shift_id, 'status', 'registration_closed'
        );
        continue;
      end if;

      insert into registrations (helper_id, shift_id, status, source)
      values (v_helper_id, v_shift_id, 'active', 'public')
      returning id, status into v_reg_id, v_status;

      v_result := v_result || jsonb_build_object(
        'shift_id', v_shift_id, 'status', v_status, 'registration_id', v_reg_id
      );
    exception
      when sqlstate 'P0001' then -- SHIFT_FULL
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'full');
      when sqlstate 'P0002' then -- SHIFT_NOT_FOUND
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'not_found');
      when sqlstate 'P0003' then -- SHIFT_CLOSED
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'closed');
      when unique_violation then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'already_registered');
    end;
  end loop;

  return jsonb_build_object(
    'helper_id', v_helper_id,
    'edit_token', v_token,
    'results', v_result
  );
end;
$$;

grant execute on function register_helper(text, text, text, text, text, uuid[]) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_registration_by_token: liefert Helferdaten + eigene Anmeldungen
-- ----------------------------------------------------------------------------
create or replace function get_registration_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper helpers%rowtype;
  v_registrations jsonb;
begin
  select * into v_helper from helpers where edit_token_hash = hash_edit_token(p_token);

  if v_helper.id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0020';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'registration_id', r.id,
    'status', r.status,
    'created_at', r.created_at,
    'shift_id', s.id,
    'shift_name', s.name,
    'start_time', s.start_time,
    'end_time', s.end_time,
    'date', d.date,
    'event_id', ev.id,
    'event_title', ev.title
  ) order by d.date, s.start_time), '[]'::jsonb)
  into v_registrations
  from registrations r
  join shifts s on s.id = r.shift_id
  join event_days d on d.id = s.event_day_id
  join events ev on ev.id = s.event_id
  where r.helper_id = v_helper.id;

  return jsonb_build_object(
    'helper_id', v_helper.id,
    'first_name', v_helper.first_name,
    'last_name', v_helper.last_name,
    'email', v_helper.email,
    'phone', v_helper.phone,
    'notes', v_helper.notes,
    'registrations', v_registrations
  );
end;
$$;

grant execute on function get_registration_by_token(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- update_helper_contact: eigene Kontaktdaten über den Änderungslink anpassen
-- ----------------------------------------------------------------------------
create or replace function update_helper_contact(
  p_token text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
begin
  select id into v_helper_id from helpers where edit_token_hash = hash_edit_token(p_token);

  if v_helper_id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0020';
  end if;

  if (p_email is null or length(trim(p_email)) = 0)
     and (p_phone is null or length(trim(p_phone)) = 0) then
    raise exception 'MISSING_CONTACT' using errcode = 'P0011';
  end if;

  update helpers set
    first_name = trim(p_first_name),
    last_name = trim(p_last_name),
    email = nullif(trim(p_email), ''),
    phone = nullif(trim(p_phone), ''),
    notes = nullif(trim(p_notes), '')
  where id = v_helper_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function update_helper_contact(text, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- add_shifts_to_registration: weitere Schichten über den Änderungslink
-- ----------------------------------------------------------------------------
create or replace function add_shifts_to_registration(
  p_token text,
  p_shift_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_shift_id uuid;
  v_event_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_reg_id uuid;
  v_status text;
begin
  select id into v_helper_id from helpers where edit_token_hash = hash_edit_token(p_token);

  if v_helper_id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0020';
  end if;

  foreach v_shift_id in array coalesce(p_shift_ids, array[]::uuid[]) loop
    begin
      select event_id into v_event_id from shifts where id = v_shift_id;

      if v_event_id is null then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'not_found');
        continue;
      end if;

      if not event_is_open_for_registration(v_event_id) then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'registration_closed');
        continue;
      end if;

      insert into registrations (helper_id, shift_id, status, source)
      values (v_helper_id, v_shift_id, 'active', 'public')
      returning id, status into v_reg_id, v_status;

      v_result := v_result || jsonb_build_object(
        'shift_id', v_shift_id, 'status', v_status, 'registration_id', v_reg_id
      );
    exception
      when sqlstate 'P0001' then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'full');
      when sqlstate 'P0002' then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'not_found');
      when sqlstate 'P0003' then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'closed');
      when unique_violation then
        v_result := v_result || jsonb_build_object('shift_id', v_shift_id, 'status', 'already_registered');
    end;
  end loop;

  return jsonb_build_object('helper_id', v_helper_id, 'results', v_result);
end;
$$;

grant execute on function add_shifts_to_registration(text, uuid[]) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- cancel_registration_by_token: eigene Anmeldung stornieren
-- ----------------------------------------------------------------------------
create or replace function cancel_registration_by_token(
  p_token text,
  p_registration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_updated_id uuid;
begin
  select id into v_helper_id from helpers where edit_token_hash = hash_edit_token(p_token);

  if v_helper_id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0020';
  end if;

  update registrations
  set status = 'cancelled'
  where id = p_registration_id and helper_id = v_helper_id and status <> 'cancelled'
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0021';
  end if;

  return jsonb_build_object('ok', true, 'registration_id', v_updated_id);
end;
$$;

grant execute on function cancel_registration_by_token(text, uuid) to anon, authenticated;


-- ############################################################################
-- ## Datei: supabase/migrations/0006_admin_rpc.sql
-- ############################################################################
-- ============================================================================
-- 0006_admin_rpc.sql
-- Admin-Funktionen für Aktionen, die mehrere Schritte atomar in einer
-- Transaktion benötigen (z.B. Helfer verschieben). Einfache CRUD-Operationen
-- laufen direkt über die PostgREST-Tabellen-API mit den RLS-Policies aus
-- 0003_rls.sql sowie dem Kapazitäts-Trigger aus 0002_functions_triggers.sql.
--
-- Alle Funktionen prüfen die Admin-Rolle selbst (is_admin()) und sind daher
-- trotz SECURITY DEFINER sicher gegen Rechteausweitung durch normale Nutzer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_add_helper_to_shift: Helfer manuell anlegen und einer Schicht
-- zuordnen (z.B. telefonische/persönliche Zusage)
-- ----------------------------------------------------------------------------
create or replace function admin_add_helper_to_shift(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_shift_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_reg_id uuid;
  v_status text;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if (p_email is null or length(trim(p_email)) = 0)
     and (p_phone is null or length(trim(p_phone)) = 0) then
    raise exception 'MISSING_CONTACT' using errcode = 'P0011';
  end if;

  insert into helpers (first_name, last_name, email, phone, notes, edit_token_hash)
  values (
    trim(p_first_name), trim(p_last_name),
    nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    nullif(trim(p_notes), ''), hash_edit_token(generate_edit_token())
  )
  returning id into v_helper_id;

  insert into registrations (helper_id, shift_id, status, source)
  values (v_helper_id, p_shift_id, 'active', 'admin')
  returning id, status into v_reg_id, v_status;

  perform log_audit('helper_added', 'registration', v_reg_id,
    jsonb_build_object('shift_id', p_shift_id, 'helper_id', v_helper_id));

  return jsonb_build_object(
    'helper_id', v_helper_id, 'registration_id', v_reg_id, 'status', v_status
  );
end;
$$;

grant execute on function admin_add_helper_to_shift(text, text, text, text, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- admin_move_registration: Helfer atomar von einer Schicht in eine andere
-- verschieben (storniert die alte Anmeldung nur, wenn die neue erfolgreich ist)
-- ----------------------------------------------------------------------------
create or replace function admin_move_registration(
  p_registration_id uuid,
  p_new_shift_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_old_shift_id uuid;
  v_new_reg_id uuid;
  v_status text;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select helper_id, shift_id into v_helper_id, v_old_shift_id
  from registrations where id = p_registration_id;

  if v_helper_id is null then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0021';
  end if;

  insert into registrations (helper_id, shift_id, status, source)
  values (v_helper_id, p_new_shift_id, 'active', 'admin')
  returning id, status into v_new_reg_id, v_status;

  update registrations set status = 'cancelled' where id = p_registration_id;

  perform log_audit('helper_moved', 'registration', v_new_reg_id, jsonb_build_object(
    'from_shift_id', v_old_shift_id, 'to_shift_id', p_new_shift_id, 'helper_id', v_helper_id
  ));

  return jsonb_build_object(
    'new_registration_id', v_new_reg_id, 'status', v_status
  );
end;
$$;

grant execute on function admin_move_registration(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- admin_cancel_registration: Anmeldung stornieren/entfernen
-- ----------------------------------------------------------------------------
create or replace function admin_cancel_registration(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;

  perform log_audit('helper_cancelled', 'registration', p_registration_id, '{}'::jsonb);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function admin_cancel_registration(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- admin_promote_from_waitlist: erste wartende Person einer Schicht nachrücken
-- lassen (nur wenn wieder Kapazität frei ist)
-- ----------------------------------------------------------------------------
create or replace function admin_promote_from_waitlist(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update registrations
  set status = 'active'
  where id = p_registration_id and status = 'waitlist'
  returning status into v_status;

  if v_status is null then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0021';
  end if;

  perform log_audit('promoted_from_waitlist', 'registration', p_registration_id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

grant execute on function admin_promote_from_waitlist(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- admin_duplicate_event: kopiert eine Veranstaltung inkl. Tage und Schichten
-- (ohne Anmeldungen) als neuen Entwurf
-- ----------------------------------------------------------------------------
create or replace function admin_duplicate_event(p_event_id uuid, p_new_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_event_id uuid;
  v_day record;
  v_new_day_id uuid;
  v_shift record;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into events (
    slug, title, description, location, start_date, end_date,
    registration_deadline, status, public_registration_enabled,
    waitlist_enabled, show_leader_public, notify_leader_on_registration,
    notify_emails, notes
  )
  select
    e.slug || '-kopie-' || substr(gen_random_uuid()::text, 1, 8),
    p_new_title, e.description, e.location, e.start_date, e.end_date,
    null, 'draft', e.public_registration_enabled,
    e.waitlist_enabled, e.show_leader_public, e.notify_leader_on_registration,
    e.notify_emails, e.notes
  from events e where e.id = p_event_id
  returning id into v_new_event_id;

  for v_day in select * from event_days where event_id = p_event_id order by display_order loop
    insert into event_days (event_id, date, display_order)
    values (v_new_event_id, v_day.date, v_day.display_order)
    returning id into v_new_day_id;

    for v_shift in select * from shifts where event_day_id = v_day.id order by display_order loop
      insert into shifts (
        event_id, event_day_id, name, start_time, end_time, capacity,
        status, manually_locked, leader_counts_as_helper, notes, display_order
      ) values (
        v_new_event_id, v_new_day_id, v_shift.name, v_shift.start_time, v_shift.end_time,
        v_shift.capacity, 'open', false, v_shift.leader_counts_as_helper, v_shift.notes,
        v_shift.display_order
      );
    end loop;
  end loop;

  perform log_audit('event_duplicated', 'event', v_new_event_id,
    jsonb_build_object('source_event_id', p_event_id));

  return v_new_event_id;
end;
$$;

grant execute on function admin_duplicate_event(uuid, text) to authenticated;


-- ############################################################################
-- ## Datei: supabase/migrations/0007_realtime.sql
-- ############################################################################
-- ============================================================================
-- 0007_realtime.sql
-- Live-Aktualisierung der Belegungszahlen über Supabase Realtime "Broadcast
-- from Database". Es werden bewusst NUR aggregierte, nicht-personenbezogene
-- Zahlen gesendet (nie Helfernamen), damit der Kanal öffentlich (nicht
-- privat) genutzt werden kann und keine zusätzliche RLS auf
-- realtime.messages notwendig ist.
--
-- Frontend abonniert Broadcast-Events auf Topic "event:<event_id>" (ein
-- einziger Realtime-Channel pro Veranstaltungsseite reicht damit aus,
-- Payload enthält jeweils die betroffene shift_id).
-- ============================================================================

create or replace function shift_status_payload(p_shift_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'shift_id', s.id,
    'event_id', s.event_id,
    'capacity', s.capacity,
    'effective_capacity', shift_effective_capacity(s.id),
    'active_count', shift_active_count(s.id),
    'available_count', greatest(0, shift_effective_capacity(s.id) - shift_active_count(s.id)),
    'is_full', shift_active_count(s.id) >= shift_effective_capacity(s.id),
    'status', s.status
  )
  from shifts s
  where s.id = p_shift_id;
$$;

create or replace function broadcast_shift_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
  v_event_id uuid;
  v_payload jsonb;
begin
  v_shift_id := coalesce(new.shift_id, old.shift_id);
  v_payload := shift_status_payload(v_shift_id);

  if v_payload is not null then
    v_event_id := v_payload->>'event_id';
    perform realtime.send(v_payload, 'shift_status_changed', 'event:' || v_event_id, false);
  end if;

  return null;
end;
$$;

create trigger trg_broadcast_shift_status
  after insert or update or delete on registrations
  for each row execute function broadcast_shift_status();

-- Änderungen an Kapazität/Status einer Schicht selbst ebenfalls senden
create or replace function broadcast_shift_status_on_shift_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  v_payload := shift_status_payload(new.id);
  perform realtime.send(v_payload, 'shift_status_changed', 'event:' || new.event_id, false);
  return null;
end;
$$;

create trigger trg_broadcast_shift_status_on_shift_change
  after update on shifts
  for each row
  when (
    old.capacity is distinct from new.capacity
    or old.status is distinct from new.status
    or old.manually_locked is distinct from new.manually_locked
  )
  execute function broadcast_shift_status_on_shift_change();


-- ############################################################################
-- ## Datei: supabase/migrations/0008_admin_rpc_extra.sql
-- ############################################################################
-- ============================================================================
-- 0008_admin_rpc_extra.sql
-- Weitere Admin-RPCs: atomare Zuordnung von Schichtchef/Verantwortlichen.
-- ============================================================================

-- p_leaders: jsonb array wie [{"board_member_id":"...","role":"leader","is_primary":true}, ...]
create or replace function admin_set_shift_leaders(
  p_shift_id uuid,
  p_leaders jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leader jsonb;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from shift_leaders where shift_id = p_shift_id;

  for v_leader in select * from jsonb_array_elements(coalesce(p_leaders, '[]'::jsonb)) loop
    insert into shift_leaders (shift_id, board_member_id, role, is_primary)
    values (
      p_shift_id,
      (v_leader->>'board_member_id')::uuid,
      coalesce(v_leader->>'role', 'leader'),
      coalesce((v_leader->>'is_primary')::boolean, false)
    );
  end loop;

  perform log_audit('shift_leaders_updated', 'shift', p_shift_id, p_leaders);
end;
$$;

grant execute on function admin_set_shift_leaders(uuid, jsonb) to authenticated;


-- ############################################################################
-- ## Datei: supabase/seed.sql
-- ############################################################################
-- ============================================================================
-- seed.sql
-- Initiale Daten für die erste Veranstaltung: Weltcup Skispringen
-- Titisee-Neustadt 2026.
--
-- WICHTIG (siehe Aufgabenstellung Abschnitt 84/85): Dies sind nur
-- Startwerte. Alles hier Angelegte kann und soll später vollständig über
-- den Adminbereich verändert werden (Zeiten, Kapazitäten, Schichtchefs,
-- weitere Tage/Schichten). Das Frontend ist nicht auf diese Werte fest
-- programmiert, sondern lädt alles dynamisch aus der Datenbank.
--
-- Ausführen z.B. mit:
--   supabase db reset          (führt Migrationen + seed.sql lokal aus)
--   psql "$DATABASE_URL" -f supabase/seed.sql   (gegen Remote-Projekt)
-- ============================================================================

insert into app_settings (id, org_name, logo_url, color_primary, color_secondary, color_accent, default_capacity, notify_emails)
values (
  1,
  'Ornemer Raugeisthexen',
  '/assets/raugeisthexen-logo.svg',
  '#111111',
  '#c81e1e',
  '#1f8a3b',
  4,
  '{}'
)
on conflict (id) do update set
  org_name = excluded.org_name,
  logo_url = excluded.logo_url,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary,
  color_accent = excluded.color_accent,
  default_capacity = excluded.default_capacity;

do $$
declare
  v_event_id uuid;
  v_fri uuid;
  v_sat uuid;
  v_sun uuid;
begin
  insert into events (
    slug, title, description, location,
    start_date, end_date, registration_deadline,
    status, public_registration_enabled, waitlist_enabled,
    show_leader_public, notify_leader_on_registration, notes
  ) values (
    'weltcup-skispringen-2026',
    'Weltcup Skispringen Titisee-Neustadt 2026',
    'Vielen Dank, dass du uns beim Weltcup Skispringen in Titisee-Neustadt unterstützt. Wähle einfach eine oder mehrere Schichten aus, bei denen du uns helfen kannst.',
    'Hochfirstschanze, Titisee-Neustadt',
    date '2026-12-11', date '2026-12-13',
    timestamptz '2026-12-08 18:00:00+01',
    'active', true, false,
    true, false,
    'Erste Veranstaltung in diesem System. Schichtchefs werden nach der Installation über den Adminbereich zugeordnet.'
  )
  returning id into v_event_id;

  insert into event_days (event_id, date, display_order) values
    (v_event_id, date '2026-12-11', 1) returning id into v_fri;
  insert into event_days (event_id, date, display_order) values
    (v_event_id, date '2026-12-12', 2) returning id into v_sat;
  insert into event_days (event_id, date, display_order) values
    (v_event_id, date '2026-12-13', 3) returning id into v_sun;

  -- Freitag, 11.12.2026
  insert into shifts (event_id, event_day_id, name, start_time, end_time, capacity, display_order)
  values
    (v_event_id, v_fri, 'Schicht 1', time '11:00', time '15:15', 4, 1),
    (v_event_id, v_fri, 'Schicht 2', time '15:00', time '19:15', 4, 2);

  -- Samstag, 12.12.2026
  insert into shifts (event_id, event_day_id, name, start_time, end_time, capacity, display_order)
  values
    (v_event_id, v_sat, 'Schicht 1', time '09:00', time '13:45', 4, 1),
    (v_event_id, v_sat, 'Schicht 2', time '13:30', time '18:15', 4, 2);

  -- Sonntag, 13.12.2026
  insert into shifts (event_id, event_day_id, name, start_time, end_time, capacity, display_order)
  values
    (v_event_id, v_sun, 'Schicht 1', time '11:00', time '15:15', 4, 1),
    (v_event_id, v_sun, 'Schicht 2', time '15:00', time '19:15', 4, 2);
end $$;

