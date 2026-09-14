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
