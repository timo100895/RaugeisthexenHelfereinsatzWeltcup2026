// ============================================================================
// Edge Function: send-notification
//
// Wird vom Frontend NACH einer erfolgreichen öffentlichen Buchung
// (register_helper / add_shifts_to_registration) aufgerufen, um:
//   1. dem Helfer eine Bestätigungs-E-Mail zu senden (falls E-Mail hinterlegt)
//   2. den Vorstand (event.notify_emails / app_settings.notify_emails) über
//      die neue Anmeldung zu informieren
//   3. optional den zuständigen Schichtchef zu benachrichtigen, wenn das
//      Event-Flag "notify_leader_on_registration" aktiv ist
//
// Der Aufruf erfolgt bewusst NICHT mit dem Service-Role-Key im Frontend,
// sondern über diese Edge Function, die den Key ausschließlich serverseitig
// verwendet. Als Berechtigungsnachweis dient der Edit-Token, der genau wie
// bei den öffentlichen RPC-Funktionen geprüft wird (siehe
// get_registration_by_token in 0005_booking_rpc.sql).
//
// Diese Funktion ist rein zusätzlicher Komfort (E-Mail-Versand). Schlägt sie
// fehl (z.B. weil kein RESEND_API_KEY gesetzt ist), bleibt die eigentliche
// Buchung trotzdem gültig - das Frontend wertet den Rückgabewert nicht als
// Voraussetzung für den Buchungserfolg.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'Ornemer Raugeisthexen <onboarding@resend.dev>';
const NOTIFY_EMAILS_ENV = Deno.env.get('NOTIFY_EMAILS') ?? '';
const PUBLIC_SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://weltcup2026.example.de';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  edit_token: string;
  shift_ids: string[];
}

function formatTime(t: string) {
  return t?.slice(0, 5) ?? '';
}

function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY nicht gesetzt - E-Mail wird nicht versendet:', subject, to);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error('Resend-Fehler', await res.text());
    return { error: true };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    if (!body.edit_token || !Array.isArray(body.shift_ids) || body.shift_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'INVALID_REQUEST' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Token validieren + Helferdaten laden (nutzt dieselbe sichere RPC wie das Frontend)
    const { data: helperData, error: helperErr } = await supabase.rpc('get_registration_by_token', {
      p_token: body.edit_token,
    });

    if (helperErr || !helperData) {
      return new Response(JSON.stringify({ error: 'INVALID_TOKEN' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const relevantRegs = (helperData.registrations ?? []).filter((r: any) =>
      body.shift_ids.includes(r.shift_id) && r.status !== 'cancelled'
    );

    if (relevantRegs.length === 0) {
      return new Response(JSON.stringify({ ok: true, note: 'no_relevant_registrations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Zusatzinfos (Schichtchef, Event-Einstellungen) laden
    const shiftIds = relevantRegs.map((r: any) => r.shift_id);
    const { data: shifts } = await supabase
      .from('shifts')
      .select('id, event_id, leader_counts_as_helper, shift_leaders(is_primary, board_members(first_name, last_name, phone, email))')
      .in('id', shiftIds);

    const eventIds = [...new Set((shifts ?? []).map((s: any) => s.event_id))];
    const { data: events } = await supabase
      .from('events')
      .select('id, title, notify_emails, notify_leader_on_registration')
      .in('id', eventIds);
    const { data: settingsRow } = await supabase.from('app_settings').select('notify_emails').eq('id', 1).single();

    const shiftMap = new Map((shifts ?? []).map((s: any) => [s.id, s]));
    const eventMap = new Map((events ?? []).map((e: any) => [e.id, e]));

    const editLink = `${PUBLIC_SITE_URL}/meine-anmeldung/${body.edit_token}`;

    const lines = relevantRegs
      .map((r: any) => `${formatDate(r.date)}\n${formatTime(r.start_time)} - ${formatTime(r.end_time)} Uhr${r.status === 'waitlist' ? ' (Warteliste)' : ''}`)
      .join('\n\n');

    const helperName = `${helperData.first_name} ${helperData.last_name}`;

    // 1) Bestätigungs-E-Mail an den Helfer
    if (helperData.email) {
      const html = `
        <p>Hallo ${helperData.first_name},</p>
        <p>vielen Dank für deine Unterstützung. Du bist für folgende Schicht(en) eingetragen:</p>
        <pre style="font-family:inherit;white-space:pre-wrap;">${lines}</pre>
        <p>Über folgenden Link kannst du deine Anmeldung jederzeit ansehen oder ändern:</p>
        <p><a href="${editLink}">${editLink}</a></p>
        <p>Viele Grüße<br/>Ornemer Raugeisthexen</p>
      `;
      const text = `Hallo ${helperData.first_name},\n\nvielen Dank für deine Unterstützung. Du bist für folgende Schicht(en) eingetragen:\n\n${lines}\n\nÄnderungslink: ${editLink}\n\nViele Grüße\nOrnemer Raugeisthexen`;
      await sendEmail(helperData.email, 'Deine Helferanmeldung – Ornemer Raugeisthexen', html, text);
    }

    // 2) Benachrichtigung an Vereinsverantwortliche
    const notifySet = new Set<string>();
    for (const id of eventIds) {
      const ev = eventMap.get(id);
      (ev?.notify_emails ?? []).forEach((e: string) => notifySet.add(e));
    }
    (settingsRow?.notify_emails ?? []).forEach((e: string) => notifySet.add(e));
    NOTIFY_EMAILS_ENV.split(',').map((s) => s.trim()).filter(Boolean).forEach((e) => notifySet.add(e));

    if (notifySet.size > 0) {
      const html = `<p>Neue Helferanmeldung:</p><p><strong>${helperName}</strong></p><pre style="font-family:inherit;white-space:pre-wrap;">${lines}</pre>`;
      const text = `Neue Helferanmeldung:\n${helperName}\n\n${lines}`;
      for (const addr of notifySet) {
        await sendEmail(addr, 'Neue Helferanmeldung – Ornemer Raugeisthexen', html, text);
      }
    }

    // 3) Optionale Benachrichtigung des Schichtchefs
    for (const shiftId of shiftIds) {
      const shift = shiftMap.get(shiftId);
      const event = shift ? eventMap.get(shift.event_id) : null;
      if (!event?.notify_leader_on_registration) continue;
      const primary = (shift.shift_leaders ?? []).find((sl: any) => sl.is_primary);
      const leaderEmail = primary?.board_members?.email;
      if (!leaderEmail) continue;
      const reg = relevantRegs.find((r: any) => r.shift_id === shiftId);
      const html = `<p>Neue Anmeldung für deine Schicht am ${formatDate(reg.date)}, ${formatTime(reg.start_time)}-${formatTime(reg.end_time)} Uhr:</p><p><strong>${helperName}</strong></p>`;
      const text = `Neue Anmeldung für deine Schicht am ${formatDate(reg.date)}, ${formatTime(reg.start_time)}-${formatTime(reg.end_time)} Uhr: ${helperName}`;
      await sendEmail(leaderEmail, 'Neue Anmeldung für deine Schicht', html, text);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
