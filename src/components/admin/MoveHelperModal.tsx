import { useState } from 'react';
import { moveRegistration } from '@/services/admin';
import { friendlyErrorMessage } from '@/utils/errors';
import { formatDateLong, formatTimeRange } from '@/utils/time';

interface ShiftOption {
  id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface Props {
  registrationId: string;
  helperName: string;
  currentShiftId: string;
  options: ShiftOption[];
  onClose: () => void;
  onSaved: () => void;
}

export default function MoveHelperModal({
  registrationId,
  helperName,
  currentShiftId,
  options,
  onClose,
  onSaved,
}: Props) {
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    setSaving(true);
    setError(null);
    try {
      await moveRegistration(registrationId, targetId);
      onSaved();
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-1 text-xl font-bold">Helfer verschieben</h2>
        <p className="mb-4 text-sm text-gray-500">{helperName}</p>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Neue Schicht</span>
          <select
            required
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="" disabled>
              Bitte wählen …
            </option>
            {options
              .filter((o) => o.id !== currentShiftId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {formatDateLong(o.date)} · {o.name} ({formatTimeRange(o.start_time, o.end_time)})
                </option>
              ))}
          </select>
        </label>

        {error && <p className="mt-3 text-sm font-medium text-brand-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving || !targetId}
            className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Speichert …' : 'Verschieben'}
          </button>
        </div>
      </form>
    </div>
  );
}
