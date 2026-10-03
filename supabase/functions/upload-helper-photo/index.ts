// ============================================================================
// Edge Function: upload-helper-photo
//
// Nimmt das Foto eines Helfers (für die Akkreditierung) entgegen und legt es im
// PRIVATEN Storage-Bucket "helper-photos" ab. Anonyme Nutzer haben auf den
// Bucket weder Lese- noch Schreibrechte - der Upload läuft ausschließlich über
// diese Funktion, die den Service-Role-Key serverseitig verwendet.
//
// Berechtigungsnachweis ist der persönliche Edit-Token des Helfers (derselbe,
// der auch den Änderungslink absichert). Er wird über die bestehende RPC
// get_registration_by_token geprüft; daraus ergibt sich die helper_id, unter
// der das Foto abgelegt und in helpers.photo_path vermerkt wird.
//
// Erwartet multipart/form-data mit den Feldern:
//   edit_token : string
//   photo      : JPEG-Datei (das Frontend skaliert/konvertiert vor dem Upload)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKET = 'helper-photos';
const MAX_BYTES = 4 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const form = await req.formData();
    const token = form.get('edit_token');
    const photo = form.get('photo');

    if (typeof token !== 'string' || token.length === 0 || !(photo instanceof File)) {
      return json({ error: 'INVALID_REQUEST' }, 400);
    }
    if (photo.size === 0) {
      return json({ error: 'INVALID_FILE' }, 400);
    }
    if (photo.size > MAX_BYTES) {
      return json({ error: 'FILE_TOO_LARGE' }, 400);
    }

    const bytes = new Uint8Array(await photo.arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isJpeg) {
      return json({ error: 'INVALID_FILE' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: helperData, error: helperErr } = await supabase.rpc('get_registration_by_token', {
      p_token: token,
    });
    if (helperErr || !helperData?.helper_id) {
      return json({ error: 'INVALID_TOKEN' }, 400);
    }

    const helperId: string = helperData.helper_id;
    const path = `${helperId}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (uploadErr) {
      console.error('Storage-Fehler', uploadErr);
      return json({ error: 'STORAGE_ERROR' }, 500);
    }

    const { error: updateErr } = await supabase
      .from('helpers')
      .update({ photo_path: path, photo_uploaded_at: new Date().toISOString() })
      .eq('id', helperId);
    if (updateErr) {
      console.error('DB-Fehler', updateErr);
      return json({ error: 'STORAGE_ERROR' }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
