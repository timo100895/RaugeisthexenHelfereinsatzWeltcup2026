// ============================================================================
// Edge Function: get-helper-photo
//
// Liefert einem Helfer sein EIGENES, bereits hochgeladenes Foto (damit er auf
// der Seite "Meine Anmeldung" sieht, welches Bild gespeichert ist, bevor er es
// ersetzt). Der Bucket "helper-photos" ist privat; die Funktion prüft den
// persönlichen Edit-Token und gibt eine nur 5 Minuten gültige, signierte URL
// zurück - ausschließlich für das Foto genau dieses Helfers.
//
// Erwartet JSON: { "edit_token": "..." }
// Antwort:       { "url": "https://..." }  bzw. { "url": null } ohne Foto
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKET = 'helper-photos';
const URL_LIFETIME_SECONDS = 300;

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
    const body = await req.json().catch(() => null);
    const token = body?.edit_token;
    if (typeof token !== 'string' || token.length === 0) {
      return json({ error: 'INVALID_REQUEST' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: helperData, error: helperErr } = await supabase.rpc('get_registration_by_token', {
      p_token: token,
    });
    if (helperErr || !helperData?.helper_id) {
      return json({ error: 'INVALID_TOKEN' }, 400);
    }
    if (!helperData.has_photo) {
      return json({ url: null });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(`${helperData.helper_id}.jpg`, URL_LIFETIME_SECONDS);
    if (error || !data) {
      console.error('Signed-URL-Fehler', error);
      return json({ error: 'STORAGE_ERROR' }, 500);
    }

    return json({ url: data.signedUrl });
  } catch (err) {
    console.error(err);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
