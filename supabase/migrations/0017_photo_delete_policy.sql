-- ============================================================================
-- 0017_photo_delete_policy.sql
--
-- Admins (Rolle "admin", nicht "viewer") dürfen Fotos aus dem privaten Bucket
-- "helper-photos" löschen - einzeln oder gesammelt nach einer Veranstaltung.
-- Lesen dürfen weiterhin Admins und Viewer (siehe 0016), anonyme Nutzer haben
-- keinerlei Zugriff.
-- ============================================================================

drop policy if exists helper_photos_admin_delete on storage.objects;
create policy helper_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'helper-photos' and public.is_admin());
