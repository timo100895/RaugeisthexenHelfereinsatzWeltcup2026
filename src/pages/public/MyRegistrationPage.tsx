import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useSettings } from '@/context/SettingsContext';
import { useEventShiftStatus } from '@/hooks/useEventShiftStatus';
import type { HelperWithRegistrations } from '@/types/database';
import { formatDateLong, formatTimeRange } from '@/utils/time';
import { friendlyErrorMessage } from '@/utils/errors';
import Logo from '@/components/Logo';
import LoadingScreen from '@/components/LoadingScreen';
import ShiftCard from '@/components/public/ShiftCard';

export default function MyRegistrationPage() {
  const { token } = useParams<{ token: string }>();
  const { settings } = useSettings();
  const [data, setData] = useState<HelperWithRegistrations | null | 'invalid'>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [addingShifts, setAddingShifts] = useState(false);
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set());

  const currentEventId =
    data && data !== 'invalid' && data.registrations.length > 0 ? data.registrations[0].event_id : null;
  const { shifts: eventShifts } = useEventShiftStatus(addingShifts ? currentEventId : null);

  async function load() {
    if (!token) return;
    const { data: res, error: err } = await supabase.rpc('get_registration_by_token', { p_token: token });
    if (err || !res) {
      setData('invalid');
      return;
    }
    const helper = res as HelperWithRegistrations;
    setData(helper);
    setFirstName(helper.first_name);
    setLastName(helper.last_name);
    setEmail(helper.email ?? '');
    setPhone(helper.phone ?? '');
    setNotes(helper.notes ?? '');
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveContact() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: err } = await supabase.rpc('update_helper_contact', {
        p_token: token,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: email.trim() || null,
        p_phone: phone.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (err) throw err;
      setMessage('Deine Kontaktdaten wurden aktualisiert.');
      await load();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function cancelRegistration(registrationId: string) {
    if (!token) return;
    if (!window.confirm('Diese Schicht wirklich absagen?')) return;
    setError(null);
    try {
      const { error: err } = await supabase.rpc('cancel_registration_by_token', {
        p_token: token,
        p_registration_id: registrationId,
      });
      if (err) throw err;
      await load();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function addSelectedShifts() {
    if (!token || selectedNew.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('add_shifts_to_registration', {
        p_token: token,
        p_shift_ids: [...selectedNew],
      });
      if (err) throw err;
      setSelectedNew(new Set());
      setAddingShifts(false);
      await load();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (data === null) return <LoadingScreen label="Anmeldung wird geladen …" />;

  if (data === 'invalid') {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold">Link ungültig</h1>
        <p className="mt-2 text-gray-600">Dieser Änderungslink ist ungültig oder wurde falsch kopiert.</p>
        <Link to="/" className="mt-4 inline-block text-brand-red underline">
          Zur Startseite
        </Link>
      </div>
    );
  }

  const activeRegs = data.registrations.filter((r) => r.status !== 'cancelled');
  const cancelledRegs = data.registrations.filter((r) => r.status === 'cancelled');
  const existingShiftIds = new Set(data.registrations.map((r) => r.shift_id));

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white pb-16">
      <header className="flex items-center gap-3 bg-brand-black px-4 py-5 text-white">
        <Logo size={44} className="rounded bg-white p-1" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-300">
            {settings.org_name}
          </p>
          <p className="font-bold">Meine Anmeldung</p>
        </div>
      </header>

      <div className="flex flex-col gap-8 p-4">
        <section>
          <h2 className="mb-3 text-lg font-bold">Deine Schichten</h2>
          {activeRegs.length === 0 ? (
            <p className="text-gray-500">Du hast aktuell keine aktiven Schichten.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeRegs.map((r) => (
                <li
                  key={r.registration_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <div>
                    <p className="font-semibold">{formatDateLong(r.date)}</p>
                    <p className="text-gray-700">{formatTimeRange(r.start_time, r.end_time)}</p>
                    {r.status === 'waitlist' && (
                      <p className="mt-1 text-sm font-medium text-brand-red">Auf Warteliste</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelRegistration(r.registration_id)}
                    className="focus-ring rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-brand-red"
                  >
                    Absagen
                  </button>
                </li>
              ))}
            </ul>
          )}

          {cancelledRegs.length > 0 && (
            <details className="mt-4 text-sm text-gray-500">
              <summary className="cursor-pointer">Abgesagte Schichten ({cancelledRegs.length})</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {cancelledRegs.map((r) => (
                  <li key={r.registration_id}>
                    {formatDateLong(r.date)}, {formatTimeRange(r.start_time, r.end_time)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {currentEventId && (
            <div className="mt-4">
              {!addingShifts ? (
                <button
                  type="button"
                  onClick={() => setAddingShifts(true)}
                  className="focus-ring rounded-xl border border-brand-red px-4 py-3 font-semibold text-brand-red"
                >
                  + Weitere Schichten hinzufügen
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {eventShifts
                    .filter((s) => !existingShiftIds.has(s.shift_id))
                    .map((s) => (
                      <ShiftCard
                        key={s.shift_id}
                        shift={s}
                        selected={selectedNew.has(s.shift_id)}
                        disabled={false}
                        onToggle={() =>
                          setSelectedNew((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.shift_id)) next.delete(s.shift_id);
                            else next.add(s.shift_id);
                            return next;
                          })
                        }
                      />
                    ))}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingShifts(false);
                        setSelectedNew(new Set());
                      }}
                      className="focus-ring flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={addSelectedShifts}
                      disabled={selectedNew.size === 0 || saving}
                      className="focus-ring flex-1 rounded-xl bg-brand-red py-3 font-bold text-white disabled:opacity-60"
                    >
                      {saving ? 'Wird gespeichert …' : `${selectedNew.size || ''} hinzufügen`.trim()}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Kontaktdaten</h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Vorname</span>
                <input
                  className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Nachname</span>
                <input
                  className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">E-Mail</span>
              <input
                type="email"
                className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Telefon</span>
              <input
                type="tel"
                className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Bemerkung</span>
              <textarea
                className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            {error && <p className="text-sm font-medium text-brand-red">{error}</p>}
            {message && <p className="text-sm font-medium text-brand-green-dark">{message}</p>}

            <button
              type="button"
              onClick={saveContact}
              disabled={saving}
              className="focus-ring rounded-xl bg-brand-black py-4 font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Wird gespeichert …' : 'Kontaktdaten speichern'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
