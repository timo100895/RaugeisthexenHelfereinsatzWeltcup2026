-- ============================================================================
-- 0010_shift_leader_freitext.sql
--
-- Erlaubt es, den Schichtchef direkt als Freitext (Name + optional Telefon)
-- an der Schicht einzutragen, ohne zwingend eine Person in "Vorstand /
-- Verantwortliche" anlegen zu muessen (der Schichtchef kann sich von
-- Veranstaltung zu Veranstaltung aendern und muss kein Vorstandsmitglied
-- sein). Die bestehende, ueber shift_leaders verknuepfte Zuordnung zu
-- board_members bleibt zusaetzlich moeglich (z.B. fuer die
-- Schichtchef-Auswertung ueber mehrere Schichten hinweg).
--
-- Anzeige-Prioritaet ueberall (Admin, Druck, Export, oeffentliche Seite):
-- shifts.leader_name, falls gesetzt - sonst der primaere verknuepfte
-- Vorstands-/Verantwortlichen-Eintrag.
-- ============================================================================

alter table shifts
  add column leader_name text,
  add column leader_phone text;

comment on column shifts.leader_name is
  'Freitext-Name des Schichtchefs (Vorrang vor verknuepftem Vorstandsmitglied)';
comment on column shifts.leader_phone is
  'Optionale Telefonnummer zum Freitext-Schichtchef';

-- Oeffentliche View aktualisieren: Freitext-Name hat Vorrang, sonst wie
-- bisher der Name des primaeren verknuepften Vorstandsmitglieds.
create or replace view public_shift_status
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
    when e.show_leader_public then coalesce(
      s.leader_name,
      (
        select bm.first_name || coalesce(' (' || bm.position || ')', '')
        from shift_leaders sl
        join board_members bm on bm.id = sl.board_member_id
        where sl.shift_id = s.id and sl.is_primary
        limit 1
      )
    )
    else null
  end as leader_public_name
from shifts s
join event_days d on d.id = s.event_day_id
join events e on e.id = s.event_id
where e.status in ('active', 'closed')
  and e.public_registration_enabled = true;

grant select on public_shift_status to anon, authenticated;
