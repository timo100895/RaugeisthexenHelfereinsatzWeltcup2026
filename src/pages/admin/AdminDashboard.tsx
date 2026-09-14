import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEvents, listShiftsForEvent } from '@/services/admin';
import type { EventRow } from '@/types/database';
import { computeOccupancy } from '@/utils/capacity';
import LoadingScreen from '@/components/LoadingScreen';
import { formatDateShort } from '@/utils/time';

export default function AdminDashboard() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    listEvents().then((data) => {
      setEvents(data);
      const active = data.find((e) => e.status === 'active') ?? data[0];
      setSelectedEventId(active?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    listShiftsForEvent(selectedEventId).then(setShifts);
  }, [selectedEventId]);

  if (events === null) return <LoadingScreen />;

  const event = events.find((e) => e.id === selectedEventId);

  if (!event) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-600">
          Es wurde noch keine Veranstaltung angelegt.{' '}
          <Link to="/admin/veranstaltungen" className="text-brand-red underline">
            Jetzt anlegen
          </Link>
        </p>
      </div>
    );
  }

  let totalCapacity = 0;
  let totalFilled = 0;
  let fullyStaffed = 0;
  let openShifts = 0;

  if (shifts) {
    for (const s of shifts) {
      const occ = computeOccupancy(s, s.leaders, s.registrations);
      totalCapacity += occ.capacity;
      totalFilled += occ.active;
      if (s.status === 'open') {
        if (occ.isFull) fullyStaffed += 1;
        else openShifts += 1;
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {events.length > 1 && (
          <select
            className="mt-2 rounded-lg border border-gray-300 px-3 py-2"
            value={selectedEventId ?? ''}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Aktuelle Veranstaltung
        </p>
        <h2 className="mt-1 text-xl font-bold">{event.title}</h2>
        <p className="text-gray-500">
          {formatDateShort(event.start_date)} – {formatDateShort(event.end_date)}
        </p>
      </div>

      {!shifts ? (
        <LoadingScreen />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Helferplätze gesamt"
            value={`${totalFilled} / ${totalCapacity}`}
            sub={`${Math.max(0, totalCapacity - totalFilled)} frei`}
            tone={totalFilled >= totalCapacity && totalCapacity > 0 ? 'green' : 'red'}
          />
          <StatCard
            label="Schichten"
            value={`${shifts.length}`}
            sub={`${fullyStaffed} vollständig besetzt · ${openShifts} noch offen`}
            tone={openShifts === 0 ? 'green' : 'red'}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/admin/heute" className="rounded-xl bg-brand-black px-4 py-3 font-semibold text-white">
          Heutige Schichten ansehen
        </Link>
        <Link
          to={`/admin/veranstaltungen/${event.id}/schichten`}
          className="rounded-xl border border-gray-300 px-4 py-3 font-semibold"
        >
          Schichten verwalten
        </Link>
        <Link to="/admin/helfer" className="rounded-xl border border-gray-300 px-4 py-3 font-semibold">
          Helferübersicht
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'green' | 'red';
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
      <p className={`mt-1 text-sm font-semibold ${tone === 'green' ? 'text-brand-green-dark' : 'text-brand-red'}`}>
        {sub}
      </p>
    </div>
  );
}
