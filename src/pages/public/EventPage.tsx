import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useSettings } from '@/context/SettingsContext';
import { useEventShiftStatus } from '@/hooks/useEventShiftStatus';
import type { EventRow, PublicShiftStatus } from '@/types/database';
import { formatDateLong, computeOverlap, isRegistrationDeadlinePassed } from '@/utils/time';
import Logo from '@/components/Logo';
import ShiftCard from '@/components/public/ShiftCard';
import HandoverDivider from '@/components/HandoverDivider';
import LoadingScreen from '@/components/LoadingScreen';
import RegistrationForm, { type RegisterResult } from '@/components/public/RegistrationForm';
import RegistrationSuccess from '@/components/public/RegistrationSuccess';

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSettings();
  const [event, setEvent] = useState<EventRow | null | 'not_found'>(null);
  const { shifts, loading: shiftsLoading } = useEventShiftStatus(
    event && event !== 'not_found' ? event.id : null
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [successResult, setSuccessResult] = useState<RegisterResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
      if (!cancelled) setEvent((data as EventRow) ?? 'not_found');
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const days = useMemo(() => {
    const map = new Map<string, PublicShiftStatus[]>();
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.start_time.localeCompare(b.start_time));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shifts]);

  if (event === null) return <LoadingScreen label="Veranstaltung wird geladen …" />;

  if (event === 'not_found') {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold">Veranstaltung nicht gefunden</h1>
        <p className="mt-2 text-gray-600">
          Diese Veranstaltung existiert nicht oder ist aktuell nicht öffentlich sichtbar.
        </p>
        <Link to="/" className="mt-4 inline-block text-brand-red underline">
          Zur Startseite
        </Link>
      </div>
    );
  }

  const deadlinePassed = isRegistrationDeadlinePassed(event.registration_deadline);
  const registrationClosed = !event.public_registration_enabled || event.status === 'closed' || deadlinePassed;

  const selectedShifts = shifts.filter((s) => selected.has(s.shift_id));

  function toggleShift(shiftId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  }

  if (successResult) {
    return (
      <div className="mx-auto min-h-screen max-w-2xl bg-white">
        <Header event={event} />
        <RegistrationSuccess result={successResult} shifts={shifts} />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white pb-28">
      <Header event={event} />

      <div className="px-4 py-6">
        <h1 className="text-2xl font-extrabold leading-tight text-brand-black">{event.title}</h1>
        {event.location && <p className="mt-1 text-gray-500">{event.location}</p>}
        {event.description && <p className="mt-4 text-gray-700">{event.description}</p>}

        {registrationClosed && (
          <div className="mt-4 rounded-xl bg-gray-100 p-4 text-sm font-medium text-gray-700">
            {deadlinePassed
              ? 'Die Helferanmeldung ist geschlossen (Anmeldeschluss erreicht).'
              : 'Die Helferanmeldung ist aktuell nicht möglich.'}
          </div>
        )}
      </div>

      {shiftsLoading ? (
        <LoadingScreen label="Schichten werden geladen …" />
      ) : days.length === 0 ? (
        <p className="px-4 text-gray-500">Für diese Veranstaltung sind aktuell keine Schichten geplant.</p>
      ) : (
        <div className="flex flex-col gap-8 px-4">
          {days.map(([date, dayShifts]) => (
            <section key={date}>
              <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-brand-black">
                {formatDateLong(date)}
              </h2>
              <div className="flex flex-col gap-1">
                {dayShifts.map((shift, idx) => {
                  const next = dayShifts[idx + 1];
                  const overlap = next ? computeOverlap(shift, next) : null;
                  return (
                    <div key={shift.shift_id}>
                      <ShiftCard
                        shift={shift}
                        selected={selected.has(shift.shift_id)}
                        disabled={registrationClosed}
                        onToggle={() => toggleShift(shift.shift_id)}
                      />
                      {overlap?.hasOverlap && overlap.start && overlap.end && (
                        <HandoverDivider start={overlap.start} end={overlap.end} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="px-4 py-8 text-center text-xs text-gray-400">
        <Link to="/datenschutz" className="underline">
          Datenschutz
        </Link>
        {' · '}
        {settings.org_name}
      </footer>

      {selected.size > 0 && !registrationClosed && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <p className="font-semibold">
              {selected.size} {selected.size === 1 ? 'Schicht' : 'Schichten'} ausgewählt
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="focus-ring rounded-xl bg-brand-red px-6 py-3 font-bold text-white active:scale-[0.99]"
            >
              Schicht auswählen
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <RegistrationForm
          shifts={selectedShifts}
          onClose={() => setShowForm(false)}
          onSuccess={(result) => {
            setShowForm(false);
            setSuccessResult(result);
          }}
        />
      )}
    </div>
  );
}

function Header({ event }: { event: EventRow }) {
  const { settings } = useSettings();
  return (
    <header className="border-b border-gray-100 bg-brand-black px-4 py-6 text-white">
      <div className="flex items-center gap-4">
        <Logo size={56} className="rounded bg-white p-1" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            {settings.org_name}
          </p>
          <p className="text-lg font-bold">Helfereinteilung</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-300">{event.title}</p>
    </header>
  );
}
