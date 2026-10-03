import { supabase } from './supabase';

/**
 * Lädt das Foto eines Helfers über die Edge Function "upload-helper-photo"
 * hoch. Der persönliche Edit-Token dient als Berechtigungsnachweis. Wirft bei
 * einem Fehler einen Error, dessen message der Fehlercode der Funktion ist
 * (siehe friendlyErrorMessage in src/utils/errors.ts).
 */
export async function uploadHelperPhoto(editToken: string, photo: Blob): Promise<void> {
  const form = new FormData();
  form.append('edit_token', editToken);
  form.append('photo', photo, 'photo.jpg');

  const { error } = await supabase.functions.invoke('upload-helper-photo', { body: form });
  if (!error) return;

  let code = 'UPLOAD_FAILED';
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = await context.json();
      if (body?.error) code = String(body.error);
    } catch {
      /* Antwort war kein JSON - generischer Fehler genügt */
    }
  }
  throw new Error(code);
}

/**
 * Holt eine kurzlebige, signierte URL zum EIGENEN, bereits hochgeladenen Foto
 * des Helfers (null, wenn noch keines vorliegt). Siehe Edge Function
 * "get-helper-photo".
 */
export async function fetchOwnPhotoUrl(editToken: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('get-helper-photo', {
    body: { edit_token: editToken },
  });
  if (error) throw new Error('UPLOAD_FAILED');
  return (data?.url as string | null) ?? null;
}
