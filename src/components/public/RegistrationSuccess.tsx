import { Link } from 'react-router-dom';
import type { PublicShiftStatus } from '@/types/database';
import { formatDateLong, formatTimeRange } from '@/utils/time';
import { resultStatusLabel } from '@/utils/errors';
import type { RegisterResult } from './RegistrationForm';

interface Props {
  result: RegisterResult;
  shifts: PublicShiftStatus[];
}

export default function RegistrationSuccess({ result, shifts }: Props) {
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
