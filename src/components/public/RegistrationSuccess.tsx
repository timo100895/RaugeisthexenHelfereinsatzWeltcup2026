import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventRow, PublicShiftStatus } from '@/types/database';
import { formatDateLong, formatTimeRange } from '@/utils/time';
import { resultStatusLabel } from '@/utils/errors';
import type { RegisterResult } from './RegistrationForm';
import PhotoStandaloneUpload from './PhotoStandaloneUpload';

interface Props {
  result: RegisterResult;
  shifts: PublicShiftStatus[];
  event: Pick<EventRow, 'photo_mode' | 'photo_hint'>;
}

export default function RegistrationSuccess({ result, shifts, event }: Props) {
  const [photoDone, setPhotoDone] = useState(false);
  const shiftById = new Map(shifts.map((s) => [s.shift_id, s]));
  const successful = result.results.filter((r) => r.status === 'active' || r.status === 'waitlist');
  const failed = result.results.filter((r) => r.status !== 'active' && r.status !== 'waitlist');

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-green/10 text-3xl text-brand-green-dark">
        ✓
      </div>
      <h1 className="text-2xl font-bold">Vielen Dank für deine Unterstützung!</h1>
      <p className="mt-2 text-gray-600">Deine Helferanmeldung wurde erfolgreich gespeichert.</p>

      {successful.length > 0 && (
        <div className="mt-6 text-left">
          <p className="mb-2 font-semibold">Deine Schichten:</p>
          <ul className="flex flex-col gap-2">
            {successful.map((r) => {
              const shift = shiftById.get(r.shift_id);
              if (!shift) return null;
              return (
                <li key={r.shift_id} className="rounded-xl border border-gray-200 p-3">
                  <p className="font-semibold">{formatDateLong(shift.date)}</p>
                  <p className="text-gray-700">{formatTimeRange(shift.start_time, shift.end_time)}</p>
                  {r.status === 'waitlist' && (
                    <p className="mt-1 text-sm font-medium text-brand-red">Auf Warteliste</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-6 text-left">
          <p className="mb-2 font-semibold text-brand-red">Nicht möglich:</p>
          <ul className="flex flex-col gap-2">
            {failed.map((r) => {
              const shift = shiftById.get(r.shift_id);
              return (
                <li key={r.shift_id} className="rounded-xl bg-red-50 p-3 text-sm">
                  {shift && (
                    <span className="font-semibold">
                      {formatDateLong(shift.date)}, {formatTimeRange(shift.start_time, shift.end_time)}:{' '}
                    </span>
                  )}
                  {resultStatusLabel(r.status)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(result.photo_status === 'failed' || result.photo_status === 'missing') && !photoDone && (
        <div className="mt-6 rounded-xl border border-gray-200 p-4 text-left">
          <p className="mb-3 font-semibold">
            {result.photo_status === 'failed'
              ? 'Dein Foto konnte nicht hochgeladen werden.'
              : 'Du hast noch kein Foto hinzugefügt.'}
          </p>
          <p className="mb-3 text-sm text-gray-600">
            Deine Anmeldung ist gespeichert. Das Foto kannst du jetzt hier nachreichen – oder später über
            deinen persönlichen Link unten.
          </p>
          <PhotoStandaloneUpload
            editToken={result.edit_token}
            required={event.photo_mode === 'required'}
            hint={event.photo_hint ?? null}
            hasPhoto={false}
            recommended={event.photo_mode === 'recommended'}
            onUploaded={() => setPhotoDone(true)}
          />
        </div>
      )}

      {(result.photo_status === 'uploaded' || photoDone) && (
        <p className="mt-6 rounded-xl bg-brand-green/10 p-3 text-sm font-medium text-brand-green-dark">
          ✓ Dein Foto wurde gespeichert.
        </p>
      )}

      <div className="mt-8 rounded-xl bg-brand-gray-light p-4 text-sm text-gray-600">
        <p className="mb-2">
          Über den folgenden persönlichen Link kannst du deine Anmeldung jederzeit ansehen, ändern oder
          absagen. Bitte speichere ihn dir (z.B. als Lesezeichen oder Screenshot):
        </p>
        <Link
          to={`/meine-anmeldung/${result.edit_token}`}
          className="break-all font-medium text-brand-red underline"
        >
          {window.location.origin}/meine-anmeldung/{result.edit_token}
        </Link>
      </div>

      <Link
        to="/"
        className="focus-ring mt-8 inline-block rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700"
      >
        Zurück zur Übersicht
      </Link>
    </div>
  );
}
