import { useState } from 'react';
import PhotoPicker from './PhotoPicker';
import { uploadHelperPhoto } from '@/services/photos';
import { friendlyErrorMessage } from '@/utils/errors';

interface Props {
  editToken: string;
  required: boolean;
  hint: string | null;
  hasPhoto: boolean;
  onUploaded?: () => void;
}

/** Foto nachträglich hochladen bzw. ersetzen (Erfolgsseite, "Meine Anmeldung"). */
export default function PhotoStandaloneUpload({ editToken, required, hint, hasPhoto, onUploaded }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  async function upload() {
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      await uploadHelperPhoto(editToken, blob);
      setUploaded(true);
      setBlob(null);
      onUploaded?.();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const photoOnFile = hasPhoto || uploaded;

  return (
    <div className="flex flex-col gap-3 text-left">
      {photoOnFile && !blob && (
        <p className="rounded-xl bg-brand-green/10 p-3 text-sm font-medium text-brand-green-dark">
          ✓ Dein Foto wurde gespeichert. Du kannst es unten bei Bedarf durch ein neues ersetzen.
        </p>
      )}

      <PhotoPicker
        blob={blob}
        onChange={setBlob}
        required={required && !photoOnFile}
        requireContactData={false}
        hint={hint}
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
