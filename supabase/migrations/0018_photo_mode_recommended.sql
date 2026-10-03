-- ============================================================================
-- 0018_photo_mode_recommended.sql
--
-- Neuer Foto-Modus "recommended" (Empfohlen): Das Foto ist keine Pflicht, der
-- Helfer wird aber bei der Anmeldung zweimal daran erinnert (beim "Weiter" und
-- beim "Verbindlich anmelden") und kann trotzdem ohne Foto fortfahren.
--
-- Bereits auf "Pflicht" gestellte Veranstaltungen werden auf "Empfohlen"
-- umgestellt (gewünschtes Verhalten: Foto soll keine Pflicht sein). Im Admin
-- lässt sich pro Veranstaltung jederzeit wieder "Pflicht" wählen.
-- ============================================================================

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%photo_mode%'
  loop
    execute format('alter table public.events drop constraint %I', c.conname);
  end loop;
end $$;

alter table events
  add constraint events_photo_mode_check
  check (photo_mode in ('off', 'optional', 'recommended', 'required'));

update events set photo_mode = 'recommended' where photo_mode = 'required';
