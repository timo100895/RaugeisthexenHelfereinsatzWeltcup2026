-- ============================================================================
-- 0008_admin_rpc_extra.sql
-- Weitere Admin-RPCs: atomare Zuordnung von Schichtchef/Verantwortlichen.
-- ============================================================================

-- p_leaders: jsonb array wie [{"board_member_id":"...","role":"leader","is_primary":true}, ...]
create or replace function admin_set_shift_leaders(
  p_shift_id uuid,
  p_leaders jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leader jsonb;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from shift_leaders where shift_id = p_shift_id;

  for v_leader in select * from jsonb_array_elements(coalesce(p_leaders, '[]'::jsonb)) loop
    insert into shift_leaders (shift_id, board_member_id, role, is_primary)
    values (
      p_shift_id,
      (v_leader->>'board_member_id')::uuid,
      coalesce(v_leader->>'role', 'leader'),
      coalesce((v_leader->>'is_primary')::boolean, false)
    );
  end loop;

  perform log_audit('shift_leaders_updated', 'shift', p_shift_id, p_leaders);
end;
$$;

grant execute on function admin_set_shift_leaders(uuid, jsonb) to authenticated;
