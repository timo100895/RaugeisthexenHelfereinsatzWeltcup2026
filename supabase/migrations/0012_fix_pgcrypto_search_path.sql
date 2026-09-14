-- ============================================================================
-- 0012_fix_pgcrypto_search_path.sql
--
-- BUGFIX: Alle Funktionen, die den Edit-Token hashen/generieren (also
-- letztlich digest()/gen_random_bytes() aus der Erweiterung "pgcrypto"
-- benoetigen), waren mit "set search_path = public" zu eng eingestellt.
-- Supabase installiert pgcrypto standardmaessig in ein separates Schema
-- "extensions", nicht in "public" - dadurch schlugen register_helper,
-- get_registration_by_token, update_helper_contact,
-- add_shifts_to_registration, cancel_registration_by_token und
-- admin_add_helper_to_shift mit "function digest(text, unknown) does not
-- exist" fehl.
--
-- Fix: search_path dieser Funktionen um "extensions" erweitern. Die
-- Sicherheitseigenschaft (fest gesetzter, nicht vom Aufrufer manipulierbarer
-- search_path) bleibt vollstaendig erhalten, es wird nur ein zusaetzliches,
-- unkritisches Schema (nur Erweiterungsfunktionen, keine Nutzerdaten)
-- hinzugefuegt.
-- ============================================================================

create or replace function hash_edit_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

create or replace function generate_edit_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

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
set search_path = public, extensions
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

  return jsonb_build_object(
    'helper_id', v_helper_id,
    'edit_token', v_token,
    'results', v_result
  );
end;
$$;

create or replace function get_registration_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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
set search_path = public, extensions
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

create or replace function add_shifts_to_registration(
  p_token text,
  p_shift_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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

create or replace function cancel_registration_by_token(
  p_token text,
  p_registration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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
set search_path = public, extensions
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
