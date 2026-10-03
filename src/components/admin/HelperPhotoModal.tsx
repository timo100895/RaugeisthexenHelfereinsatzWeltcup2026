import { useEffect, useState } from 'react';
import { deleteHelperPhotos, getHelperPhotoUrl } from '@/services/admin';
import { friendlyErrorMessage } from '@/utils/errors';

interface Props {
  helperId: string;
  helperName: string;
  photoPath: string;
  uploadedAt: string | null;
  /** Nur Admins dürfen löschen (Viewer sehen das Foto nur). */
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function HelperPhotoModal({
  helperId,
  helperName,
  photoPath,
  uploadedAt,
  canDelete,
  onClose,
  onDeleted,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHelperPhotoUrl(photoPath)
      .then((signed) => {
        if (!cancelled) setUrl(signed);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  async function remove() {
    if (!window.confirm(`Foto von ${helperName} endgültig löschen? Das kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    const result = await deleteHelperPhotos([{ id: helperId, path: photoPath }], {
      entityType: 'helper',
      entityId: helperId,
    });
    setDeleting(false);
    if (result.deleted === 1) {
      onDeleted();
      onClose();
    } else {
      setError('Das Foto konnte nicht gelöscht werden. Bitte versuche es erneut.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5">
        <div>
          <h2 className="text-lg font-bold">{helperName}</h2>
          {uploadedAt && (
            <p className="text-sm text-gray-500">
              Hochgeladen am {new Date(uploadedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>

        {url ? (
          <img src={url} alt={`Foto von ${helperName}`} className="w-full rounded-xl border border-gray-200" />
        ) : (
          !error && <p className="py-10 text-center text-gray-500">Foto wird geladen …</p>
        )}

        {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2">
            Schließen
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {deleting ? 'Löscht …' : 'Foto löschen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
