import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEvent, listEventDays, createEventDay, deleteEventDay } from '@/services/admin';
import type { EventRow, EventDayRow } from '@/types/database';
import LoadingScreen from '@/components/LoadingScreen';
import { formatDateLong } from '@/utils/time';

export default function AdminEventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [days, setDays] = useState<EventDayRow[] | null>(null);
  const [newDate, setNewDate] = useState('');

  async function reload() {
    if (!eventId) return;
    setEvent(await getEvent(eventId));
    setDays(await listEventDays(eventId));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!event || days === null) return <LoadingScreen />;

  async function addDay(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !eventId) return;
    await createEventDay(eventId, newDate, (days?.length ?? 0) + 1);
    setNewDate('');
    await reload();
  }

  async function removeDay(id: string) {
    if (!window.confirm('Diesen Veranstaltungstag inkl. aller zugehörigen Schichten wirklich löschen?')) return;
    await deleteEventDay(id);
    await reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/veranstaltungen" className="text-sm text-gray-500 underline">
          ← Alle Veranstaltungen
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-bold">Veranstaltungstage</h2>
        <ul className="flex flex-col gap-2">
          {days.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg bg-brand-gray-light p-3">
              <span className="font-medium">{formatDateLong(d.date)}</span>
              <button onClick={() => removeDay(d.id)} className="text-sm font-semibold text-brand-red">
                Löschen
              </button>
            </li>
          ))}
          {days.length === 0 && <p className="text-gray-500">Noch keine Tage angelegt.</p>}
        </ul>

        <form onSubmit={addDay} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Neuer Veranstaltungstag</span>
            <input
              type="date"
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </label>
          <button type="submit" className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white">
            + Tag hinzufügen
          </button>
        </form>
      </div>

      <Link
        to={`/admin/veranstaltungen/${event.id}/schichten`}
        className="w-fit rounded-xl bg-brand-black px-4 py-3 font-semibold text-white"
      >
        Schichten verwalten →
      </Link>
    </div>
  );
}
