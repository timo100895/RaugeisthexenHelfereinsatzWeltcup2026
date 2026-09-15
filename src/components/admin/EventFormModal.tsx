import { useState } from 'react';
import type { EventRow } from '@/types/database';
import type { EventInput } from '@/services/admin';

interface Props {
  initial?: EventRow;
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function EventFormModal({ initial, onClose, onSave }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [deadline, setDeadline] = useState(
    initial?.registration_deadline ? initial.registration_deadline.slice(0, 16) : ''
  );
  const [status, setStatus] = useState<EventRow['status']>(initial?.status ?? 'draft');
  const [publicEnabled, setPublicEnabled] = useState(initial?.public_registration_enabled ?? true);
  const [waitlistEnabled, setWaitlistEnabled] = useState(initial?.waitlist_enabled ?? false);
  const [showLeaderPublic, setShowLeaderPublic] = useState(initial?.show_leader_public ?? true);
  const [notifyLeader, setNotifyLeader] = useState(initial?.notify_leader_on_registration ?? false);
  const [notifyEmails, setNotifyEmails] = useState(initial?.notify_emails.join(', ') ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(!!initial);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        slug: (slug.trim() || slugify(title)).trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start_date: startDate,
        end_date: endDate,
        registration_deadline: deadline ? new Date(deadline).toISOString() : null,
        status,
        public_registration_enabled: publicEnabled,
        waitlist_enabled: waitlistEnabled,
        show_leader_public: showLeaderPublic,
        notify_leader_on_registration: notifyLeader,
        notify_emails: notifyEmails
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: notes.trim() || null,
      });
    } catch (err: any) {
      setError(err.message ?? 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white p-6"
      >
        <h2 className="mb-4 text-xl font-bold">{initial ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Titel *</span>
            <input
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">URL-Kurzname (Slug) *</span>
            <input
              required
              className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Kurzbeschreibung</span>
            <textarea
              className="rounded-lg border border-gray-300 px-3 py-2"
              rows={3}
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Ort</span>
            <input
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={location ?? ''}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Startdatum *</span>
            <input
              type="date"
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Enddatum *</span>
            <input
              type="date"
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Anmeldeschluss</span>
            <input
              type="datetime-local"
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Status</span>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventRow['status'])}
            >
              <option value="draft">Entwurf</option>
              <option value="active">Aktiv</option>
              <option value="closed">Geschlossen</option>
              <option value="archived">Archiviert</option>
            </select>
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={publicEnabled}
              onChange={(e) => setPublicEnabled(e.target.checked)}
            />
            <span>Öffentliche Anmeldung aktiv</span>
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={waitlistEnabled}
              onChange={(e) => setWaitlistEnabled(e.target.checked)}
            />
            <span>Warteliste aktiv</span>
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={showLeaderPublic}
              onChange={(e) => setShowLeaderPublic(e.target.checked)}
            />
            <span>Verantwortlichen (Schichtchef) öffentlich anzeigen</span>
          </label>
          {/* E-Mail-Benachrichtigungen (Schichtchef-Info, Vorstands-Adressen) sind
              ausgeblendet, solange kein E-Mail-Versand (Resend) eingerichtet ist -
              siehe README, Abschnitt "E-Mail-Versand konfigurieren". notifyLeader/
              notifyEmails bleiben im State erhalten (unveraendert gespeichert),
              die Felder koennen jederzeit wieder eingeblendet werden. */}

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Bemerkung</span>
            <textarea
              className="rounded-lg border border-gray-300 px-3 py-2"
              rows={2}
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-brand-red">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
