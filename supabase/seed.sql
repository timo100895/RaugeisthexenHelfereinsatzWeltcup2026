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
