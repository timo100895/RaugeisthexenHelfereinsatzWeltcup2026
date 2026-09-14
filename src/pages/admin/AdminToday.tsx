import { useEffect, useState } from 'react';
import { listEvents, listShiftsForEvent } from '@/services/admin';
import { computeOccupancy } from '@/utils/capacity';
import { formatDateLong, formatTimeRange, toMinutes } from '@/utils/time';
import LoadingScreen from '@/components/LoadingScreen';
import { ShiftStatusPill } from '@/components/admin/StatusPill';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminToday() {
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    listEvents().then(async (events) => {
      const active = events.find((e) => e.status === 'active');
      if (!active) {
        setShifts([]);
        return;
      }
      const all = await listShiftsForEvent(active.id);
      setShifts(all);
    });
  }, []);

  if (shifts === null) return <LoadingScreen />;

  const today = todayIso();
  const todaysShifts = shifts
    .filter((s) => s.event_day.date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const current = todaysShifts.filter(
    (s) => toMinutes(s.start_time) <= nowMinutes && nowMinutes < toMinutes(s.end_time)
  );
  const next = todaysShifts.find((s) => toMinutes(s.start_time) > nowMinutes);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Heute</h1>
        <p className="text-gray-500">{formatDateLong(today)}</p>
      </div>

      {todaysShifts.length === 0 ? (
        <p className="text-gray-500">Heute sind keine Schichten für die aktuelle Veranstaltung geplant.</p>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-red">Jetzt</h2>
            {current.length === 0 ? (
              <p className="text-gray-500">Aktuell läuft keine Schicht.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {current.map((s) => (
                  <ShiftBlock key={s.id} shift={s} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              Als Nächstes
            </h2>
            {!next ? (
              <p className="text-gray-500">Für heute sind keine weiteren Schichten mehr geplant.</p>
            ) : (
              <ShiftBlock shift={next} />
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              Alle heutigen Schichten
            </h2>
            <div className="flex flex-col gap-3">
              {todaysShifts.map((s) => (
                <ShiftBlock key={s.id} shift={s} compact />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ShiftBlock({ shift, compact }: { shift: any; compact?: boolean }) {
  const occ = computeOccupancy(shift, shift.leaders, shift.registrations);
  const primary = shift.leaders.find((l: any) => l.is_primary);
  const activeHelpers = shift.registrations.filter((r: any) => r.status === 'active');

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${compact ? '' : 'shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{shift.name}</p>
          <p className="text-gray-600">{formatTimeRange(shift.start_time, shift.end_time)}</p>
        </div>
        <ShiftStatusPill occupancy={occ} shiftStatus={shift.status} />
      </div>
      {primary && (
        <p className="mt-2 text-sm text-gray-600">
          Schichtchef: <strong>{primary.board_member.first_name} {primary.board_member.last_name}</strong>
          {primary.board_member.phone && ` · ${primary.board_member.phone}`}
        </p>
      )}
      {!compact && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
          {activeHelpers.map((r: any) => (
            <li key={r.id}>
              {r.helper.first_name} {r.helper.last_name}
              {r.helper.phone && ` · ${r.helper.phone}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
