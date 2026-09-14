import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEvents, createEvent, updateEvent, duplicateEvent, type EventInput } from '@/services/admin';
import type { EventRow } from '@/types/database';
import LoadingScreen from '@/components/LoadingScreen';
import EventFormModal from '@/components/admin/EventFormModal';
import { GenericPill } from '@/components/admin/StatusPill';
import { formatDateShort } from '@/utils/time';

const STATUS_LABEL: Record<EventRow['status'], { label: string; tone: 'green' | 'red' | 'gray' }> = {
  draft: { label: 'Entwurf', tone: 'gray' },
  active: { label: 'Aktiv', tone: 'green' },
  closed: { label: 'Geschlossen', tone: 'red' },
  archived: { label: 'Archiviert', tone: 'gray' },
};

export default function AdminEvents() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [editing, setEditing] = useState<EventRow | null | 'new'>(null);

  async function reload() {
    setEvents(await listEvents());
  }

  useEffect(() => {
    reload();
  }, []);

  if (events === null) return <LoadingScreen />;

  async function handleSave(input: EventInput) {
    if (editing === 'new') {
      await createEvent(input);
    } else if (editing) {
      await updateEvent(editing.id, input);
    }
    setEditing(null);
    await reload();
  }

  async function handleDuplicate(event: EventRow) {
    const title = window.prompt('Titel der neuen Veranstaltung:', `${event.title} (Kopie)`);
    if (!title) return;
    await duplicateEvent(event.id, title);
    await reload();
  }

  async function handleArchive(event: EventRow) {
    if (!window.confirm(`"${event.title}" wirklich archivieren?`)) return;
    await updateEvent(event.id, { status: 'archived' });
    await reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Veranstaltungen</h1>
        <button
          onClick={() => setEditing('new')}
          className="rounded-xl bg-brand-red px-4 py-2 font-semibold text-white"
        >
          + Neue Veranstaltung
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <div key={event.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{event.title}</h2>
                  <GenericPill tone={STATUS_LABEL[event.status].tone}>
                    {STATUS_LABEL[event.status].label}
                  </GenericPill>
                </div>
                <p className="text-gray-500">
                  {formatDateShort(event.start_date)} – {formatDateShort(event.end_date)}
                  {event.location && ` · ${event.location}`}
                </p>
                <p className="text-xs text-gray-400">/veranstaltung/{event.slug}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/admin/veranstaltungen/${event.id}/schichten`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                >
                  Schichten
                </Link>
                <button
                  onClick={() => setEditing(event)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDuplicate(event)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                >
                  Duplizieren
                </button>
                {event.status !== 'archived' && (
                  <button
                    onClick={() => handleArchive(event)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-brand-red"
                  >
                    Archivieren
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-gray-500">Noch keine Veranstaltungen angelegt.</p>}
      </div>

      {editing && (
        <EventFormModal
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
