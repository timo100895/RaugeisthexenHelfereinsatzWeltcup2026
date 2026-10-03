import { useMemo, useState } from 'react';
import type { EventRow } from '@/types/database';
import { supabase } from '@/services/supabase';
import { collectAccreditationPersons } from '@/utils/accreditation';
import { buildAccreditationWorkbook } from '@/utils/accreditationExport';
import { downloadBlob } from '@/utils/xlsxExport';

const STORAGE_KEY = 'accreditation-settings-v1';
const DEFAULT_TITLE = 'FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026';
const DEFAULT_FUNKTION = 'Arbeitseinsatz Bewirtungsstand Ski Club';

interface Settings {
  title: string;
  ressort: string;
  verein: string;
  funktion: string;
}

function loadSettings(defaultVerein: string): Settings {
  const defaults: Settings = {
    title: DEFAULT_TITLE,
    ressort: '',
    verein: defaultVerein,
    funktion: DEFAULT_FUNKTION,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* localStorage evtl. nicht verfügbar - Standardwerte genügen */
  }
  return defaults;
}

interface Props {
  event: EventRow;
  shifts: any[] | null;
  orgName: string;
}

/**
 * Akkreditierungsliste (Excel im Layout der Vorlage) und Download aller Fotos
 * als ZIP. In der Liste steht pro Person der Dateiname des Fotos
 * (Vorname_Nachname.jpg) - dieselben Namen tragen die Dateien im ZIP.
 */
export default function AccreditationCard({ event, shifts, orgName }: Props) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(orgName));
  const [busy, setBusy] = useState<'xlsx' | 'zip' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const persons = useMemo(() => collectAccreditationPersons(shifts ?? []), [shifts]);
  const withoutPhoto = persons.filter((p) => !p.photoPath);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignorieren */
    }
  }

  async function downloadList() {
    setBusy('xlsx');
    setMessage(null);
    try {
      const buffer = await buildAccreditationWorkbook({ ...settings, persons });
      downloadBlob(
        `Akkreditierungsliste_${event.slug}.xlsx`,
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      );
    } catch (err) {
      setMessage('Die Liste konnte nicht erstellt werden. Bitte versuche es erneut.');
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function downloadZip() {
    setBusy('zip');
    setMessage(null);
    setProgress(null);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      zip.file('Akkreditierungsliste.xlsx', await buildAccreditationWorkbook({ ...settings, persons }));
      const folder = zip.folder('Fotos')!;

      const withPhoto = persons.filter((p) => p.photoPath && p.photoFileName);
      let done = 0;
      const failed: string[] = [];
      const queue = [...withPhoto];

      const worker = async () => {
        for (let person = queue.shift(); person; person = queue.shift()) {
          const { data, error } = await supabase.storage.from('helper-photos').download(person.photoPath!);
          if (error || !data) failed.push(`${person.firstName} ${person.lastName}`);
          else folder.file(person.photoFileName!, data);
          done += 1;
          setProgress(`Fotos werden geladen … ${done} / ${withPhoto.length}`);
        }
      };
      await Promise.all(Array.from({ length: 5 }, worker));

      setProgress('ZIP-Datei wird erstellt …');
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(`Akkreditierung_${event.slug}.zip`, blob);

      setMessage(
        failed.length > 0
          ? `${failed.length} Foto(s) konnten nicht geladen werden: ${failed.join(', ')}`
          : `${withPhoto.length} Foto(s) und die Akkreditierungsliste wurden heruntergeladen.`
      );
    } catch (err) {
      setMessage('Der Download ist fehlgeschlagen. Bitte versuche es erneut.');
      console.error(err);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const fields: { key: keyof Settings; label: string }[] = [
    { key: 'title', label: 'Titelzeile' },
    { key: 'ressort', label: 'Name Ressort' },
    { key: 'verein', label: 'Verein' },
    { key: 'funktion', label: 'Funktion (für alle Personen)' },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-bold">Akkreditierungsliste &amp; Fotos</h2>
        <p className="text-sm text-gray-500">
          Enthält alle Personen mit aktiver Anmeldung für „{event.title}“. Wer sich mehrfach angemeldet
          hat, steht nur einmal in der Liste (Abgleich über Vor- und Nachname).
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{f.label}</span>
            <input
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={settings[f.key]}
              onChange={(e) => update({ [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <div className="rounded-xl bg-brand-gray-light p-3 text-sm">
        <p className="font-semibold">
          {persons.length} Person(en) in der Liste ·{' '}
          <span className={withoutPhoto.length > 0 ? 'text-brand-red' : 'text-brand-green-dark'}>
            {persons.length - withoutPhoto.length} mit Foto, {withoutPhoto.length} ohne Foto
          </span>
        </p>
        {event.photo_mode === 'off' && (
          <p className="mt-1 text-gray-600">
            Für diese Veranstaltung ist die Foto-Abfrage nicht aktiviert (Einstellung in der
            Veranstaltung unter „Bearbeiten“).
          </p>
        )}
        {withoutPhoto.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-700">Wer hat noch kein Foto?</summary>
            <p className="mt-1 text-gray-600">
              {withoutPhoto.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}
            </p>
          </details>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={downloadList}
          disabled={busy !== null || persons.length === 0}
          className="rounded-xl bg-brand-black px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy === 'xlsx' ? 'Erzeuge Liste …' : 'Download Akkreditierungsliste (Excel)'}
        </button>
        <button
          onClick={downloadZip}
          disabled={busy !== null || persons.length === 0}
          className="rounded-xl bg-brand-red px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy === 'zip' ? 'Bitte warten …' : 'Alle Fotos + Liste herunterladen (ZIP)'}
        </button>
      </div>

      {progress && <p className="text-sm text-gray-600">{progress}</p>}
      {message && <p className="text-sm font-medium text-gray-700">{message}</p>}
    </section>
  );
}
