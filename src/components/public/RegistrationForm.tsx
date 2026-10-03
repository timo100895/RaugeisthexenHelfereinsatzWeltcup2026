import { useEffect, useRef, useState } from 'react';
import type { EventRow, PublicShiftStatus } from '@/types/database';
import { formatDateLong, formatTimeRange } from '@/utils/time';
import { friendlyErrorMessage } from '@/utils/errors';
import { supabase } from '@/services/supabase';
import { uploadHelperPhoto } from '@/services/photos';
import PhotoPicker, { type PhotoPickerHandle } from './PhotoPicker';
import PhotoReminderDialog from './PhotoReminderDialog';

export type PhotoStatus = 'not_requested' | 'uploaded' | 'failed' | 'missing';

export interface RegisterResult {
  helper_id: string;
  edit_token: string;
  results: { shift_id: string; status: string; registration_id?: string }[];
  photo_status: PhotoStatus;
}

type RpcRegisterResult = Omit<RegisterResult, 'photo_status'>;

interface Props {
  shifts: PublicShiftStatus[];
  event: Pick<EventRow, 'photo_mode' | 'require_contact_data' | 'photo_hint'>;
  onClose: () => void;
  onSuccess: (result: RegisterResult) => void;
}

export default function RegistrationForm({ shifts, event, onClose, onSuccess }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<'saving' | 'photo'>('saving');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const pickerRef = useRef<PhotoPickerHandle>(null);
  // Modus "Empfohlen": zwei Erinnerungen (1: beim Weiter, 2: beim Anmelden), jeweils nur einmal
  const [reminder, setReminder] = useState<0 | 1 | 2>(0);
  const [reminded1, setReminded1] = useState(false);
  const [reminded2, setReminded2] = useState(false);
  const [openPickerAfterBack, setOpenPickerAfterBack] = useState(false);

  const photoMode = event.photo_mode ?? 'off';
  const requireContactData = event.require_contact_data ?? false;
  const photoRequired = photoMode === 'required';
  const photoRecommended = photoMode === 'recommended';

  useEffect(() => {
    if (openPickerAfterBack && step === 'form') {
      pickerRef.current?.openHint();
      setOpenPickerAfterBack(false);
    }
  }, [openPickerAfterBack, step]);

  function goToSummary(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Bitte gib deinen Vor- und Nachnamen an.');
      return;
    }
    if (requireContactData && !email.trim()) {
      setError('Für diese Veranstaltung ist eine E-Mail-Adresse Pflicht.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Bitte gib mindestens eine E-Mail-Adresse oder eine Telefonnummer an.');
      return;
    }
    if (photoRequired && !photo) {
      setError('Bitte füge ein aktuelles Foto hinzu (Button „Bild hinzufügen“).');
      return;
    }
    if (photoRecommended && !photo && !reminded1) {
      setReminded1(true);
      setReminder(1);
      return;
    }
    setStep('summary');
  }

  // Erinnerung 2: beim Klick auf "Verbindlich anmelden" ohne Foto
  function requestSubmit() {
    if (photoRecommended && !photo && !reminded2) {
      setReminded2(true);
      setReminder(2);
      return;
    }
    submit();
  }

  function reminderAddPhoto() {
    setReminder(0);
    setStep('form');
    setOpenPickerAfterBack(true);
  }

  function reminderContinue() {
    const current = reminder;
    setReminder(0);
    if (current === 1) setStep('summary');
    else submit();
  }

  async function submit() {
    setSubmitting(true);
    setPhase('saving');
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('register_helper', {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: email.trim() || null,
        p_phone: phone.trim() || null,
        p_notes: notes.trim() || null,
        p_shift_ids: shifts.map((s) => s.shift_id),
      });

      if (rpcError) throw rpcError;

      const result = data as RpcRegisterResult;
      const anySuccess = result.results.some((r) => r.status === 'active' || r.status === 'waitlist');

      // Foto erst NACH der erfolgreichen Anmeldung hochladen (der Edit-Token
      // dient als Berechtigungsnachweis). Schlägt der Upload fehl, bleibt die
      // Anmeldung gültig - die Erfolgsseite bietet dann einen erneuten Versuch an.
      let photoStatus: PhotoStatus = photoMode === 'off' ? 'not_requested' : 'missing';
      if (photo && photoMode !== 'off' && anySuccess) {
        setPhase('photo');
        try {
          await uploadHelperPhoto(result.edit_token, photo);
          photoStatus = 'uploaded';
        } catch {
          photoStatus = 'failed';
        }
      }

      // Bestätigungs-/Benachrichtigungs-E-Mails asynchron auslösen (best effort,
      // die Buchung selbst ist bereits erfolgreich gespeichert).
      supabase.functions
        .invoke('send-notification', {
          body: { edit_token: result.edit_token, shift_ids: shifts.map((s) => s.shift_id) },
        })
        .catch(() => {
          /* E-Mail-Versand ist ein Komfortfeature, Fehler hier ignorieren wir bewusst */
        });

      onSuccess({ ...result, photo_status: photoStatus });
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-bold">
            {step === 'form' ? 'Deine Kontaktdaten' : 'Deine Helfereinsätze'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {step === 'form' ? (
            <form onSubmit={goToSummary} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Vorname *</span>
                  <input
                    className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Nachname *</span>
                  <input
                    className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">
                  E-Mail-Adresse{requireContactData ? ' *' : ''}
                </span>
                <input
                  type="email"
                  className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  required={requireContactData}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Mobilnummer</span>
                <input
                  type="tel"
                  className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>
              <p className="text-xs text-gray-500">
                {requireContactData
                  ? 'Vorname, Nachname und E-Mail-Adresse sind Pflichtangaben.'
                  : 'Bitte mindestens eine E-Mail-Adresse oder Telefonnummer angeben.'}
              </p>

              {photoMode !== 'off' && (
                <PhotoPicker
                  ref={pickerRef}
                  label={photoRecommended ? 'Foto (empfohlen)' : undefined}
                  blob={photo}
                  onChange={setPhoto}
                  required={photoRequired}
                  requireContactData={requireContactData}
                  hint={event.photo_hint ?? null}
                />
              )}
              {photoRecommended && !photo && (
                <p className="-mt-2 text-xs text-gray-500">
                  Empfohlen: Für die Akkreditierung wird ein aktuelles Foto benötigt. Du kannst es auch später
                  nachreichen.
                </p>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Bemerkung (optional)</span>
                <textarea
                  className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

              <p className="text-xs text-gray-500">
                Deine Daten werden ausschließlich zur Organisation der Helfereinsätze verwendet.{' '}
                <a href="/datenschutz" target="_blank" className="underline">
                  Mehr erfahren
                </a>
              </p>

              <button
                type="submit"
                className="focus-ring w-full rounded-xl bg-brand-red py-4 text-lg font-bold text-white active:scale-[0.99]"
              >
                Weiter
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="font-semibold">Deine Helfereinsätze</p>
              <ul className="flex flex-col gap-2">
                {shifts.map((s) => (
                  <li key={s.shift_id} className="rounded-xl bg-brand-gray-light p-3">
                    <p className="font-semibold">{formatDateLong(s.date)}</p>
                    <p className="text-gray-700">{formatTimeRange(s.start_time, s.end_time)}</p>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="font-semibold">
                  {firstName} {lastName}
                </p>
                {email && <p className="text-sm text-gray-600">{email}</p>}
                {phone && <p className="text-sm text-gray-600">{phone}</p>}
                {photoMode !== 'off' && (
                  <p className="mt-1 text-sm text-gray-600">
                    Foto: {photo ? '✓ hinzugefügt' : 'nicht hinzugefügt'}
                  </p>
                )}
              </div>

              {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={submitting}
                  className="focus-ring flex-1 rounded-xl border border-gray-300 py-4 font-semibold text-gray-700"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={requestSubmit}
                  disabled={submitting}
                  className="focus-ring flex-1 rounded-xl bg-brand-red py-4 font-bold text-white disabled:opacity-60"
                >
                  {submitting
                    ? phase === 'photo'
                      ? 'Foto wird hochgeladen …'
                      : 'Anmeldung wird gespeichert …'
                    : 'Verbindlich anmelden'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {reminder !== 0 && (
        <PhotoReminderDialog
          step={reminder}
          onAddPhoto={reminderAddPhoto}
          onContinueWithoutPhoto={reminderContinue}
        />
      )}
    </div>
  );
}
