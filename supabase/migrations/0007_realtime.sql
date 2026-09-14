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
