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
