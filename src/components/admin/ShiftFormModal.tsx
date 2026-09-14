import { useState } from 'react';
import type { BoardMemberRow, EventDayRow, ShiftRow } from '@/types/database';
import type { LeaderAssignment, ShiftInput } from '@/services/admin';

interface ShiftWithLeaders extends ShiftRow {
  leaders?: { board_member_id: string; role: 'leader' | 'support'; is_primary: boolean }[];
}

interface Props {
  eventId: string;
  days: EventDayRow[];
  boardMembers: BoardMemberRow[];
  initial?: ShiftWithLeaders;
  defaultDayId?: string;
  onClose: () => void;
  onSave: (input: ShiftInput, leaders: LeaderAssignment[]) => Promise<void>;
}

export default function ShiftFormModal({
  eventId,
  days,
  boardMembers,
  initial,
  defaultDayId,
  onClose,
  onSave,
}: Props) {
  const [dayId, setDayId] = useState(initial?.event_day_id ?? defaultDayId ?? days[0]?.id ?? '');
  const [name, setName] = useState(initial?.name ?? 'Schicht');
  const [startTime, setStartTime] = useState(initial?.start_time?.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(initial?.end_time?.slice(0, 5) ?? '');
  const [capacity, setCapacity] = useState(initial?.capacity ?? 4);
  const [status, setStatus] = useState<ShiftRow['status']>(initial?.status ?? 'open');
  const [manuallyLocked, setManuallyLocked] = useState(initial?.manually_locked ?? false);
  const [leaderCounts, setLeaderCounts] = useState(initial?.leader_counts_as_helper ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [leaderIds, setLeaderIds] = useState<Set<string>>(
    new Set(initial?.leaders?.map((l) => l.board_member_id) ?? [])
  );
  const [primaryId, setPrimaryId] = useState<string | null>(
    initial?.leaders?.find((l) => l.is_primary)?.board_member_id ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLeader(id: string) {
    setLeaderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryId === id) setPrimaryId(null);
      } else {
        next.add(id);
        if (!primaryId) setPrimaryId(id);
      }
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const leaders: LeaderAssignment[] = [...leaderIds].map((id) => ({
        board_member_id: id,
        role: 'leader',
        is_primary: id === primaryId,
      }));

      await onSave(
        {
          event_id: eventId,
          event_day_id: dayId,
          name: name.trim(),
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          capacity: Number(capacity),
          status,
          manually_locked: manuallyLocked,
          leader_counts_as_helper: leaderCounts,
          notes: notes.trim() || null,
          display_order: initial?.display_order ?? 0,
        },
        leaders
      );
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
        <h2 className="mb-4 text-xl font-bold">{initial ? 'Schicht bearbeiten' : 'Neue Schicht'}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Veranstaltungstag *</span>
            <select
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.date}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Bezeichnung *</span>
            <input
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Schicht 1, Frühschicht, Aufbau"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Beginn *</span>
            <input
              type="time"
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Ende *</span>
            <input
              type="time"
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Benötigte Helfer *</span>
            <input
              type="number"
              min={1}
              required
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Status</span>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ShiftRow['status'])}
            >
              <option value="open">Offen</option>
              <option value="closed">Geschlossen</option>
              <option value="cancelled">Abgesagt</option>
            </select>
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={manuallyLocked}
              onChange={(e) => setManuallyLocked(e.target.checked)}
            />
            <span>Manuell gesperrt (keine weiteren Anmeldungen, auch wenn offen)</span>
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={leaderCounts} onChange={(e) => setLeaderCounts(e.target.checked)} />
            <span>Schichtchef zählt als regulärer Helfer</span>
          </label>

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

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Schichtchef / weitere Verantwortliche</p>
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            {boardMembers.length === 0 && (
              <p className="text-sm text-gray-500">
                Noch keine Vorstandsmitglieder hinterlegt (siehe Bereich „Vorstand“).
              </p>
            )}
            {boardMembers.map((bm) => (
              <div key={bm.id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={leaderIds.has(bm.id)}
                    onChange={() => toggleLeader(bm.id)}
                  />
                  <span>
                    {bm.first_name} {bm.last_name}
                    {bm.position && <span className="text-gray-500"> ({bm.position})</span>}
                  </span>
                </label>
                {leaderIds.has(bm.id) && (
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input
                      type="radio"
                      name="primary-leader"
                      checked={primaryId === bm.id}
                      onChange={() => setPrimaryId(bm.id)}
                    />
                    Hauptverantwortlicher
                  </label>
                )}
              </div>
            ))}
          </div>
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
