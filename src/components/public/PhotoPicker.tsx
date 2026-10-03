import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { compressImageToJpeg } from '@/utils/photo';
import { friendlyErrorMessage } from '@/utils/errors';

/** Erlaubt dem Formular, den Hinweisdialog (und damit die Foto-Auswahl) von außen zu öffnen. */
export interface PhotoPickerHandle {
  openHint: () => void;
}

interface Props {
  blob: Blob | null;
  onChange: (blob: Blob | null) => void;
  /** Foto ist für diese Veranstaltung Pflicht. */
  required: boolean;
  /** Vorname/Nachname/E-Mail sind für diese Veranstaltung Pflicht. */
  requireContactData: boolean;
  /** Hinweistext der Veranstaltung (wird beim Klick auf "Bild hinzufügen" angezeigt). */
  hint: string | null;
  /** Überschrift über dem Feld (Standard: "Foto" mit Pflicht-/Optional-Zusatz). */
  label?: string;
  disabled?: boolean;
}

/**
 * Foto-Auswahl: Beim ersten Klick auf "Bild hinzufügen" erscheint zuerst der
 * Hinweis zu den Foto-Vorgaben, danach öffnet sich die Dateiauswahl (Kamera
 * oder Galerie). Das Bild wird sofort verkleinert/als JPEG vorbereitet; die
 * Vorschau sieht nur der Nutzer selbst.
 */
const PhotoPicker = forwardRef<PhotoPickerHandle, Props>(function PhotoPicker(
  { blob, onChange, required, requireContactData, hint, label, disabled },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ openHint: () => setShowHint(true) }));

  useEffect(() => {
    if (!blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setProcessing(true);
    try {
      onChange(await compressImageToJpeg(file));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  }

  function confirmHint() {
    setShowHint(false);
    inputRef.current?.click();
  }

  const mandatory: string[] = [];
  if (requireContactData) mandatory.push('Vorname, Nachname und E-Mail-Adresse');
  if (required) mandatory.push('ein aktuelles Foto');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">
        {label ?? `Foto ${required ? '*' : '(optional)'}`}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        disabled={disabled}
      />

      {previewUrl ? (
        <div className="flex items-center gap-4">
          <img
            src={previewUrl}
            alt="Vorschau deines Fotos"
            className="h-28 w-24 rounded-xl border border-gray-200 object-cover"
          />
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              disabled={disabled || processing}
              onClick={() => inputRef.current?.click()}
              className="focus-ring rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
            >
              Anderes Bild wählen
            </button>
            {!required && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(null)}
                className="text-sm font-semibold text-brand-red underline"
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || processing}
          onClick={() => setShowHint(true)}
          className="focus-ring rounded-xl border-2 border-dashed border-gray-300 px-4 py-4 text-base font-semibold text-gray-700 hover:border-brand-red/60"
        >
          {processing ? 'Bild wird vorbereitet …' : '📷 Bild hinzufügen'}
        </button>
      )}

      {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

      {showHint && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl">
            <div className="border-b border-gray-100 p-4">
              <h3 className="text-lg font-bold">Foto für die Akkreditierung</h3>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto p-4 text-sm text-gray-700">
              {hint && <p className="whitespace-pre-line">{hint}</p>}

              {mandatory.length > 0 && (
                <p className="rounded-xl bg-yellow-50 p-3 font-medium text-gray-800">
                  Pflichtangaben bei dieser Veranstaltung: {mandatory.join(' sowie ')}.
                </p>
              )}

              <p className="text-gray-500">
                Dein Foto ist öffentlich nicht sichtbar – nur berechtigte Administratoren des Vereins können
                es einsehen.
              </p>
            </div>
            <div className="flex gap-3 border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={() => setShowHint(false)}
                className="focus-ring flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmHint}
                className="focus-ring flex-1 rounded-xl bg-brand-red py-3 font-bold text-white"
              >
                Verstanden – Foto auswählen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PhotoPicker;
