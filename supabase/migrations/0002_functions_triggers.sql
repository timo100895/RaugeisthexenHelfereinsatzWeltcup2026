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
