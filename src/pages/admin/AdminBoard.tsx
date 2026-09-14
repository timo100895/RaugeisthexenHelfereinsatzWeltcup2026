import { useEffect, useState } from 'react';
import {
  listBoardMembers,
  createBoardMember,
  updateBoardMember,
  deleteBoardMember,
  type BoardMemberInput,
} from '@/services/admin';
import type { BoardMemberRow } from '@/types/database';
import LoadingScreen from '@/components/LoadingScreen';
import { GenericPill } from '@/components/admin/StatusPill';

const EMPTY: BoardMemberInput = {
  first_name: '',
  last_name: '',
  position: '',
  email: '',
  phone: '',
  active: true,
};

export default function AdminBoard() {
  const [members, setMembers] = useState<BoardMemberRow[] | null>(null);
  const [editing, setEditing] = useState<BoardMemberRow | 'new' | null>(null);
  const [form, setForm] = useState<BoardMemberInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setMembers(await listBoardMembers(true));
  }

  useEffect(() => {
    reload();
  }, []);

  function startEdit(member: BoardMemberRow | 'new') {
    setEditing(member);
    setForm(
      member === 'new'
        ? EMPTY
        : {
            first_name: member.first_name,
            last_name: member.last_name,
            position: member.position ?? '',
            email: member.email ?? '',
            phone: member.phone ?? '',
            active: member.active,
          }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: BoardMemberInput = {
      ...form,
      position: form.position?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
    };
    if (editing === 'new') {
      await createBoardMember(payload);
    } else if (editing) {
      await updateBoardMember(editing.id, payload);
    }
    setSaving(false);
    setEditing(null);
    await reload();
  }

  async function remove(member: BoardMemberRow) {
    if (
      !window.confirm(
        `"${member.first_name} ${member.last_name}" wirklich löschen? Das ist nur möglich, wenn die Person keiner Schicht als Verantwortliche/r zugeordnet ist.`
      )
    )
      return;
    try {
      await deleteBoardMember(member.id);
      await reload();
    } catch {
      alert(
        'Löschen nicht möglich – diese Person ist noch mindestens einer Schicht als Verantwortliche/r zugeordnet. Du kannst sie stattdessen deaktivieren.'
      );
    }
  }

  if (members === null) return <LoadingScreen />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vorstand / Verantwortliche</h1>
        <button
          onClick={() => startEdit('new')}
          className="rounded-xl bg-brand-red px-4 py-2 font-semibold text-white"
        >
          + Person hinzufügen
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">
                  {m.first_name} {m.last_name}
                </p>
                {!m.active && <GenericPill tone="gray">Inaktiv</GenericPill>}
              </div>
              <p className="text-sm text-gray-500">
                {m.position && `${m.position} · `}
                {m.phone}
                {m.phone && m.email && ' · '}
                {m.email}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(m)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => remove(m)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-brand-red"
              >
                Löschen
              </button>
            </div>
          </div>
        ))}
        {members.length === 0 && <p className="text-gray-500">Noch keine Personen hinterlegt.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-xl font-bold">
              {editing === 'new' ? 'Person hinzufügen' : 'Person bearbeiten'}
            </h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Vorname"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
                <input
                  required
                  placeholder="Nachname"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
              <input
                placeholder="Funktion (z.B. Vorstand, Zunftmeister, Beisitzer)"
                className="rounded-lg border border-gray-300 px-3 py-2"
                value={form.position ?? ''}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
              <input
                type="tel"
                placeholder="Telefonnummer"
                className="rounded-lg border border-gray-300 px-3 py-2"
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                type="email"
                placeholder="E-Mail-Adresse"
                className="rounded-lg border border-gray-300 px-3 py-2"
                value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>Aktiv</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-300 px-4 py-2"
              >
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
      )}
    </div>
  );
}
