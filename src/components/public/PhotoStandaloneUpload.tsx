import { useEffect, useState } from 'react';
import PhotoPicker from './PhotoPicker';
import { fetchOwnPhotoUrl, uploadHelperPhoto } from '@/services/photos';
import { friendlyErrorMessage } from '@/utils/errors';

interface Props {
  editToken: string;
  required: boolean;
  hint: string | null;
  hasPhoto: boolean;
  /** Modus "Empfohlen": Feld als "Foto (empfohlen)" beschriften. */
  recommended?: boolean;
  onUploaded?: () => void;
}

/**
 * Foto nachträglich hochladen bzw. ersetzen (Erfolgsseite, "Meine Anmeldung").
 * Liegt bereits ein Foto vor, wird es dem Helfer selbst angezeigt (über eine
 * kurzlebige, signierte URL - für alle anderen bleibt es unsichtbar).
 */
export default function PhotoStandaloneUpload({
  editToken,
  required,
  hint,
  hasPhoto,
  recommended,
  onUploaded,
}: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const photoOnFile = hasPhoto || uploadCount > 0;

  useEffect(() => {
    if (!photoOnFile) {
      setCurrentUrl(null);
      return;
    }
    let cancelled = false;
    fetchOwnPhotoUrl(editToken)
      .then((url) => {
        if (!cancelled) setCurrentUrl(url);
      })
      .catch(() => {
        if (!cancelled) setCurrentUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [editToken, photoOnFile, uploadCount]);

  async function upload() {
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      await uploadHelperPhoto(editToken, blob);
      setUploadCount((n) => n + 1);
      setBlob(null);
      onUploaded?.();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-left">
      {photoOnFile && (
        <div className="flex items-center gap-4 rounded-xl bg-brand-green/10 p-3">
          {currentUrl && (
            <img
              src={currentUrl}
              alt="Dein aktuell hochgeladenes Foto"
              className="h-28 w-24 shrink-0 rounded-xl border border-gray-200 bg-white object-cover"
            />
          )}
          <p className="text-sm font-medium text-brand-green-dark">
            ✓ Dein Foto wurde gespeichert{currentUrl ? ' (so sieht es aktuell aus)' : ''}. Du kannst es unten
            bei Bedarf durch ein neues ersetzen.
          </p>
        </div>
      )}

      <PhotoPicker
        blob={blob}
        onChange={setBlob}
        required={required && !photoOnFile}
        requireContactData={false}
        hint={hint}
        label={photoOnFile ? 'Neues Foto' : recommended ? 'Foto (empfohlen)' : undefined}
        disabled={uploading}
      />

      {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

      {blob && (
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className="focus-ring rounded-xl bg-brand-red py-3 font-bold text-white disabled:opacity-60"
        >
          {uploading ? 'Foto wird hochgeladen …' : photoOnFile ? 'Foto ersetzen' : 'Foto hochladen'}
        </button>
      )}
    </div>
  );
}
