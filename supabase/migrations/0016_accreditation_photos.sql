-- ============================================================================
-- 0016_accreditation_photos.sql
--
-- Foto-Upload bei der Anmeldung (für die Akkreditierung) + Pflichtangaben je
-- Veranstaltung:
--   * events.require_contact_data : Vorname, Nachname und E-Mail sind Pflicht
--   * events.photo_mode           : 'off' (Feld nicht anzeigen) | 'optional' | 'required'
--   * events.photo_hint           : Hinweistext, der beim Klick auf "Bild hinzufügen" erscheint
--   * helpers.photo_path / photo_uploaded_at : Zuordnung des Fotos zur Person
--
-- Die Fotos liegen in einem PRIVATEN Storage-Bucket ("helper-photos"). Anonyme
-- Nutzer haben weder Lese- noch Schreibrechte darauf: Der Upload läuft über die
-- Edge Function "upload-helper-photo" (prüft den persönlichen Edit-Token und
-- schreibt mit dem Service-Role-Key), das Lesen ist nur eingeloggten Admins/
-- Viewern erlaubt.
-- ============================================================================

alter table events
  add column require_contact_data boolean not null default false,
  add column photo_mode text not null default 'off'
    check (photo_mode in ('off', 'optional', 'required')),
  add column photo_hint text default $hint$Für jede Helferin und jeden Helfer wird ein aktuelles Foto benötigt – auch wenn in den vergangenen Jahren schon eine Akkreditierung vorhanden war. Ältere Fotos sind nicht mehr aktuell.

Bitte achte bei der Aufnahme auf Folgendes:
• einfarbiger, möglichst neutraler Hintergrund
• Gesicht gerade und frontal zur Kamera, kein seitliches Foto
• keine Kopfbedeckung oder Sonnenbrille
• Kopf und Hals müssen vollständig im Bildausschnitt sein
• gute Bildqualität und ausreichende Beleuchtung

Du musst die Datei nicht umbenennen – die Zuordnung zu deinem Namen erfolgt automatisch.$hint$;

alter table helpers
  add column photo_path text,
  add column photo_uploaded_at timestamptz;

-- ----------------------------------------------------------------------------
-- Privater Storage-Bucket für die Fotos
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('helper-photos', 'helper-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists helper_photos_admin_read on storage.objects;
create policy helper_photos_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'helper-photos' and public.is_admin_or_viewer());

-- ----------------------------------------------------------------------------
-- register_helper: zusätzlich serverseitige Prüfung "E-Mail ist Pflicht",
-- sofern eine der gewählten Veranstaltungen require_contact_data aktiviert hat.
-- (Sonst unverändert gegenüber 0012_fix_pgcrypto_search_path.sql.)
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

  if (p_email is null or length(trim(p_email)) = 0)
     and exists (
       select 1
       from shifts s
       join events e on e.id = s.event_id
       where s.id = any(p_shift_ids) and e.require_contact_data
     ) then
    raise exception 'MISSING_EMAIL' using errcode = 'P0013';
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

-- ----------------------------------------------------------------------------
-- get_registration_by_token: liefert zusätzlich, ob bereits ein Foto vorliegt,
-- sowie je Anmeldung die Foto-Einstellungen der Veranstaltung (damit die
-- Änderungsseite das Hochladen/Ersetzen des Fotos anbieten kann).
-- ----------------------------------------------------------------------------
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
    'event_title', ev.title,
    'event_photo_mode', ev.photo_mode,
    'event_photo_hint', ev.photo_hint
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
    'has_photo', v_helper.photo_path is not null,
    'photo_uploaded_at', v_helper.photo_uploaded_at,
    'registrations', v_registrations
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_duplicate_event: kopiert zusätzlich die neuen Einstellungen
-- (Pflichtangaben, Foto-Modus, Hinweistext). Sonst unverändert gegenüber
-- 0006_admin_rpc.sql.
-- ----------------------------------------------------------------------------
create or replace function admin_duplicate_event(p_event_id uuid, p_new_title text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
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
    notify_emails, notes, require_contact_data, photo_mode, photo_hint
  )
  select
    e.slug || '-kopie-' || substr(gen_random_uuid()::text, 1, 8),
    p_new_title, e.description, e.location, e.start_date, e.end_date,
    null, 'draft', e.public_registration_enabled,
    e.waitlist_enabled, e.show_leader_public, e.notify_leader_on_registration,
    e.notify_emails, e.notes, e.require_contact_data, e.photo_mode, e.photo_hint
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

notify pgrst, 'reload schema';
