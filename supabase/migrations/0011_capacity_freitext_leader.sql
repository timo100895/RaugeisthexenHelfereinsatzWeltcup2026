-- ============================================================================
-- 0011_capacity_freitext_leader.sql
--
-- shift_effective_capacity() beruecksichtigt jetzt auch einen per Freitext
-- (shifts.leader_name) eingetragenen Schichtchef, nicht nur einen ueber
-- shift_leaders verknuepften Vorstands-/Verantwortlichen-Eintrag. Die
-- Funktion bleibt SECURITY DEFINER (siehe 0009_fix_public_capacity_functions.sql).
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
        and (
          (s.leader_name is not null and length(trim(s.leader_name)) > 0)
          or exists (
            select 1 from shift_leaders sl
            where sl.shift_id = s.id and sl.is_primary
          )
        )
      then 1
      else 0
    end
  )
  from shifts s
  where s.id = p_shift_id;
$$;
