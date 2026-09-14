-- ============================================================================
-- 0009_fix_public_capacity_functions.sql
--
-- BUGFIX: shift_effective_capacity() und shift_active_count() liefen mit
-- INVOKER-Rechten (Standard bei "language sql"-Funktionen ohne explizites
-- SECURITY DEFINER). Wurden sie indirekt ueber die oeffentliche View
-- public_shift_status von einem anonymen Besucher aufgerufen, griff ihr
-- interner SELECT auf "shifts"/"registrations" unter der RLS-Identitaet
-- von "anon" - und anon hat dort bewusst KEIN Leserecht (siehe 0003_rls.sql).
-- Das Ergebnis war NULL statt der tatsaechlichen Kapazitaet/Belegung, obwohl
-- die View selbst (dank Owner-Rechten) technisch aufrufbar war.
--
-- Fix: beide Funktionen als SECURITY DEFINER mit fest gesetztem search_path
-- neu anlegen. Sie bleiben unkritisch, da sie ausschliesslich aggregierte
-- Zahlen (keine personenbezogenen Daten) zu einer konkreten, bereits vom
-- Aufrufer bekannten Schicht-ID zurueckgeben.
-- ============================================================================

create or replace function shift_effective_capacity(p_shift_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
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

create or replace function shift_active_count(p_shift_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from registrations
  where shift_id = p_shift_id and status = 'active';
$$;
