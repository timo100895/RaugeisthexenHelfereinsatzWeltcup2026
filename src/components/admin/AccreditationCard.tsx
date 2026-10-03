import { useMemo, useState } from 'react';
import type { EventRow } from '@/types/database';
import { supabase } from '@/services/supabase';
import { collectAccreditationPersons, collectPhotoHelpers, type PhotoHelper } from '@/utils/accreditation';
import { deleteHelperPhotos } from '@/services/admin';
import { useAuth } from '@/context/AuthContext';
import HelperPhotoModal from './HelperPhotoModal';
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
  /** Wird nach dem Löschen von Fotos aufgerufen, damit die Daten neu geladen werden. */
  onChanged: () => void;
}

/**
 * Akkreditierungsliste (Excel im Layout der Vorlage) und Download aller Fotos
 * als ZIP. In der Liste steht pro Person der Dateiname des Fotos
 * (Vorname_Nachname.jpg) - dieselben Namen tragen die Dateien im ZIP.
 */
export default function AccreditationCard({ event, shifts, orgName, onChanged }: Props) {
  const { isAdmin } = useAuth();
  const [photoView, setPhotoView] = useState<PhotoHelper | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(orgName));
  const [busy, setBusy] = useState<'xlsx' | 'zip' | 'delete' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const persons = useMemo(() => collectAccreditationPersons(shifts ?? []), [shifts]);
  const withoutPhoto = persons.filter((p) => !p.photoPath);
  const photoHelpers = useMemo(() => collectPhotoHelpers(shifts ?? []), [shifts]);

  async function deleteOne(helper: PhotoHelper) {
    if (
      !window.confirm(`Foto von ${helper.firstName} ${helper.lastName} endgültig löschen?`)
    ) {
      return;
    }
    setBusy('delete');
    setMessage(null);
    const result = await deleteHelperPhotos([{ id: helper.id, path: helper.photoPath }], {
      entityType: 'helper',
      entityId: helper.id,
    });
    setBusy(null);
    setMessage(
      result.deleted === 1
        ? `Foto von ${helper.firstName} ${helper.lastName} wurde gelöscht.`
        : 'Das Foto konnte nicht gelöscht werden. Bitte versuche es erneut.'
    );
    onChanged();
  }

  async function deleteAll() {
    if (photoHelpers.length === 0) return;
    const confirmed = window.confirm(
      `Wirklich ALLE ${photoHelpers.length} Fotos dieser Veranstaltung endgültig löschen?\n\n` +
        'Das kann nicht rückgängig gemacht werden. Lade vorher bei Bedarf das ZIP mit allen Fotos herunter.'
    );
    if (!confirmed) return;
    const typed = window.prompt('Zur Bestätigung bitte LÖSCHEN eingeben:');
    if (typed?.trim().toUpperCase() !== 'LÖSCHEN') {
      setMessage('Löschen abgebrochen – es wurde nichts gelöscht.');
      return;
    }

    setBusy('delete');
    setMessage(null);
    const result = await deleteHelperPhotos(
      photoHelpers.map((h) => ({ id: h.id, path: h.photoPath })),
      { entityType: 'event', entityId: event.id }
    );
    setBusy(null);
    setMessage(
      result.failed === 0
        ? `${result.deleted} Foto(s) wurden gelöscht.`
        : `${result.deleted} Foto(s) gelöscht, ${result.failed} konnten nicht gelöscht werden (bitte erneut versuchen).`
    );
    onChanged();
  }

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

      <div className="border-t border-gray-200 pt-4">
        <h3 className="font-bold">Fotos verwalten</h3>
        <p className="mb-3 text-sm text-gray-500">
          {photoHelpers.length === 0
            ? 'Für diese Veranstaltung sind keine Fotos gespeichert.'
            : `${photoHelpers.length} gespeicherte(s) Foto(s) – ansehen oder löschen.`}
        </p>

        {photoHelpers.length > 0 && (
          <>
            <details className="mb-3 rounded-xl border border-gray-200">
              <summary className="cursor-pointer px-3 py-2 font-medium">Liste der Fotos anzeigen</summary>
              <ul className="flex flex-col divide-y divide-gray-100 px-3 pb-2">
                {photoHelpers.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {h.firstName} {h.lastName}
                      {h.photoUploadedAt && (
                        <span className="text-gray-400">
                          {' '}
                          · {new Date(h.photoUploadedAt).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </span>
                    <span className="flex gap-3">
                      <button onClick={() => setPhotoView(h)} className="font-semibold text-gray-600 underline">
                        Ansehen
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => deleteOne(h)}
                          disabled={busy !== null}
                          className="font-semibold text-brand-red underline disabled:opacity-50"
                        >
                          Löschen
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            {isAdmin && (
              <button
                onClick={deleteAll}
                disabled={busy !== null}
                className="rounded-xl border border-brand-red px-5 py-3 font-semibold text-brand-red disabled:opacity-50"
              >
                {busy === 'delete'
                  ? 'Löscht …'
                  : `Alle ${photoHelpers.length} Fotos dieser Veranstaltung löschen`}
              </button>
            )}
          </>
        )}
      </div>

      {photoView && (
        <HelperPhotoModal
          helperId={photoView.id}
          helperName={`${photoView.firstName} ${photoView.lastName}`}
          photoPath={photoView.photoPath}
          uploadedAt={photoView.photoUploadedAt}
          canDelete={isAdmin}
          onClose={() => setPhotoView(null)}
          onDeleted={onChanged}
        />
      )}
    </section>
  );
}
