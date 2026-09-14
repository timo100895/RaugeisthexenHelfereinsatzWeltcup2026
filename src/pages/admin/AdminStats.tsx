import { useEffect, useState } from 'react';
import { listEvents, listShiftsForEvent } from '@/services/admin';
import type { EventRow } from '@/types/database';
import { computeEventStats, formatHoursDecimal } from '@/utils/stats';
import { formatDateLong } from '@/utils/time';
import LoadingScreen from '@/components/LoadingScreen';

export default function AdminStats() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [shifts, setShifts] = useState<any[] | null>(null);

  useEffect(() => {
    listEvents().then((data) => {
      setEvents(data);
      setEventId((data.find((e) => e.status === 'active') ?? data[0])?.id ?? '');
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    listShiftsForEvent(eventId).then(setShifts);
  }, [eventId]);

  if (events === null) return <LoadingScreen />;
  if (events.length === 0) return <p className="text-gray-500">Keine Veranstaltung vorhanden.</p>;

  const stats = shifts ? computeEventStats(shifts) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Auswertungen</h1>
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>

      {!stats ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="Helferplätze gesamt" value={stats.totalCapacity} />
            <MiniStat label="Belegte Plätze" value={stats.totalFilled} />
            <MiniStat label="Freie Plätze" value={stats.totalFree} />
            <MiniStat label="Unterschiedliche Helfer" value={stats.uniqueHelperCount} />
            <MiniStat label="Helfereinsätze gesamt" value={stats.totalAssignments} />
            <MiniStat label="Vollständig besetzt" value={stats.fullyStaffedShifts} />
            <MiniStat label="Noch offen" value={stats.openShifts} />
            <MiniStat label="Abgesagte Schichten" value={stats.cancelledShifts} />
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-bold">Belegung je Tag</h2>
            <div className="flex flex-col gap-2">
              {Object.entries(stats.perDay)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, d]) => (
                  <div key={date} className="flex items-center justify-between rounded-lg bg-brand-gray-light px-3 py-2">
                    <span className="font-medium">{formatDateLong(date)}</span>
                    <span>
                      {d.filled} / {d.capacity} belegt
                    </span>
                  </div>
                ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-bold">Helfereinsätze pro Person</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2">Name</th>
                    <th className="py-2">Einsätze</th>
                    <th className="py-2">Stunden</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.helperStats.map((h) => (
                    <tr key={h.helperId} className="border-b border-gray-100">
                      <td className="py-2 font-medium">
                        {h.firstName} {h.lastName}
                      </td>
                      <td className="py-2">{h.shiftCount}</td>
                      <td className="py-2">{formatHoursDecimal(h.totalMinutes)} h</td>
                    </tr>
                  ))}
                  {stats.helperStats.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-500">
                        Noch keine Anmeldungen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-bold">Einsätze als Schichtchef / Verantwortliche/r</h2>
            <div className="flex flex-col gap-2">
              {stats.leaderStats.map((l) => (
                <div key={l.boardMemberId} className="flex items-center justify-between rounded-lg bg-brand-gray-light px-3 py-2">
                  <span className="font-medium">{l.name}</span>
                  <span>{l.shiftCount} Schicht(en)</span>
                </div>
              ))}
              {stats.leaderStats.length === 0 && <p className="text-gray-500">Noch keine Zuordnungen.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
