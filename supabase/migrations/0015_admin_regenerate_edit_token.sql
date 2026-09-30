-- ============================================================================
-- 0015_admin_regenerate_edit_token.sql
--
-- Ermöglicht es Admins, für einen Helfer einen NEUEN persönlichen
-- Änderungslink zu erzeugen, falls der ursprüngliche verloren gegangen ist
-- (z.B. weil noch kein E-Mail-Versand eingerichtet ist und der Link nur
-- einmalig auf der Erfolgsseite angezeigt wurde).
--
-- Der alte Link wird dabei ungültig (der alte Hash wird überschrieben),
-- da wir den ursprünglichen Token nirgends im Klartext speichern und ihn
-- daher auch als Admin nicht "wiederherstellen" könnten - nur neu vergeben.
-- ============================================================================

create or replace function admin_regenerate_edit_token(p_helper_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_token := generate_edit_token();

  update helpers
  set edit_token_hash = hash_edit_token(v_token)
  where id = p_helper_id;

  if not found then
    raise exception 'HELPER_NOT_FOUND' using errcode = 'P0022';
  end if;

  perform log_audit('edit_token_regenerated', 'helper', p_helper_id, '{}'::jsonb);

  return v_token;
end;
$$;

grant execute on function admin_regenerate_edit_token(uuid) to authenticated;
