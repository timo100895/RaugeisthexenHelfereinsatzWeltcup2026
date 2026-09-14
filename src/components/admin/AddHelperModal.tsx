import { useState } from 'react';
import { addHelperToShift } from '@/services/admin';
import { friendlyErrorMessage } from '@/utils/errors';

interface Props {
  shiftId: string;
  shiftLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddHelperModal({ shiftId, shiftLabel, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addHelperToShift({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        shift_id: shiftId,
      });
      onSaved();
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-1 text-xl font-bold">Helfer hinzufügen</h2>
        <p className="mb-4 text-sm text-gray-500">{shiftLabel}</p>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Vorname"
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              required
              placeholder="Nachname"
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input
            type="email"
            placeholder="E-Mail"
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="tel"
            placeholder="Telefon"
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <textarea
            placeholder="Bemerkung (optional)"
            className="rounded-lg border border-gray-300 px-3 py-2"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="mt-3 text-sm font-medium text-brand-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Speichert …' : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </div>
  );
}
