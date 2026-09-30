import { useState } from 'react';

interface Props {
  helperName: string;
  token: string;
  onClose: () => void;
}

/** Zeigt einen frisch erzeugten Änderungslink an, den der Admin an den Helfer weitergeben kann. */
export default function NewEditLinkModal({ helperName, token, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/meine-anmeldung/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Zwischenablage evtl. nicht verfügbar - Link steht trotzdem sichtbar da */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-1 text-xl font-bold">Neuer Anmeldelink</h2>
        <p className="mb-4 text-sm text-gray-500">
          für {helperName} — der alte Link funktioniert ab jetzt nicht mehr.
        </p>

        <div className="break-all rounded-xl bg-brand-gray-light p-3 text-sm">{link}</div>

        <p className="mt-3 text-xs text-gray-500">
          Bitte diesen Link der Person direkt weitergeben (z.B. per WhatsApp oder Telefon).
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2">
            Schließen
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white"
          >
            {copied ? 'Kopiert ✓' : 'Link kopieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
