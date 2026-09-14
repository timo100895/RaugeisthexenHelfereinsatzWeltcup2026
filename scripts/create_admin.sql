-- ============================================================================
-- create_admin.sql
--
-- Legt das erste Admin-Profil an, NACHDEM der zugehörige Benutzer bereits im
-- Supabase Dashboard unter Authentication -> Users angelegt wurde
-- (z.B. per "Invite user" oder "Add user" mit E-Mail + Passwort).
--
-- Verwendung:
--   1. Benutzer im Supabase Dashboard anlegen, E-Mail-Adresse notieren.
--   2. In diesem Skript E-Mail-Adresse und Name unten anpassen.
--   3. Im Supabase SQL Editor ausführen (oder: supabase db execute -f ...).
-- ============================================================================

insert into admin_profiles (auth_user_id, display_name, role, active)
select id, 'Timo Reith', 'admin', true
from auth.users
where email = 'timo_reith@t-online.de'
on conflict (auth_user_id) do update set role = 'admin', active = true;
