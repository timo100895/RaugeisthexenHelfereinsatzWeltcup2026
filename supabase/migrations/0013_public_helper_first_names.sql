-- ============================================================================
-- 0013_public_helper_first_names.sql
--
-- Zeigt auf der oeffentlichen Seite zusaetzlich die VORNAMEN (nicht
-- Nachnamen, keine Kontaktdaten) bereits angemeldeter Helfer je Schicht an,
-- damit Interessierte sehen koennen, wer schon zugesagt hat. Nachnamen,
-- Telefon, E-Mail und Bemerkungen bleiben weiterhin ausschliesslich fuer
-- Admins sichtbar (siehe 0003_rls.sql).
-- ============================================================================

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
  end as leader_public_name,
  (
    select array_agg(h.first_name order by h.first_name)
    from registrations r
    join helpers h on h.id = r.helper_id
    where r.shift_id = s.id and r.status = 'active'
  ) as helper_first_names
from shifts s
join event_days d on d.id = s.event_day_id
join events e on e.id = s.event_id
where e.status in ('active', 'closed')
  and e.public_registration_enabled = true;

grant select on public_shift_status to anon, authenticated;
