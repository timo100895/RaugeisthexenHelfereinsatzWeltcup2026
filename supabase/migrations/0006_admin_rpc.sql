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
