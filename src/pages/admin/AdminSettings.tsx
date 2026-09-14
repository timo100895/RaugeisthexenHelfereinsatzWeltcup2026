import { useEffect, useState } from 'react';
import { getAppSettings, updateAppSettings } from '@/services/admin';
import { useSettings } from '@/context/SettingsContext';
import type { AppSettings } from '@/types/database';
import LoadingScreen from '@/components/LoadingScreen';

export default function AdminSettings() {
  const { refresh } = useSettings();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  if (!settings) return <LoadingScreen />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateAppSettings(settings!);
      setSettings(updated);
      await refresh();
      setMessage('Einstellungen gespeichert.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <form onSubmit={save} className="flex max-w-xl flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Vereinsname</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={settings.org_name}
            onChange={(e) => setSettings({ ...settings, org_name: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Logo-Pfad</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            value={settings.logo_url}
            onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
          />
          <span className="text-xs text-gray-500">
            Logo-Datei unter public/assets/ ablegen und Pfad hier eintragen (siehe README, "Logo
            austauschen").
          </span>
        </label>

        <div className="grid grid-cols-3 gap-4">
          <ColorField
            label="Primärfarbe (Schwarz)"
            value={settings.color_primary}
            onChange={(v) => setSettings({ ...settings, color_primary: v })}
          />
          <ColorField
            label="Sekundärfarbe (Rot)"
            value={settings.color_secondary}
            onChange={(v) => setSettings({ ...settings, color_secondary: v })}
          />
          <ColorField
            label="Akzentfarbe (Grün)"
            value={settings.color_accent}
            onChange={(v) => setSettings({ ...settings, color_accent: v })}
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Standardkapazität für neue Schichten</span>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={settings.default_capacity}
            onChange={(e) => setSettings({ ...settings, default_capacity: Number(e.target.value) })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Benachrichtigungsadressen (Komma-getrennt)</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={settings.notify_emails.join(', ')}
            onChange={(e) =>
              setSettings({
                ...settings,
                notify_emails: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Datenschutzhinweis</span>
          <textarea
            className="rounded-lg border border-gray-300 px-3 py-2"
            rows={4}
            value={settings.privacy_notice}
            onChange={(e) => setSettings({ ...settings, privacy_notice: e.target.value })}
          />
        </label>

        {message && <p className="text-sm font-medium text-brand-green-dark">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-xl bg-brand-red px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </form>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 rounded" />
        <input
          className="w-full rounded-lg border border-gray-300 px-2 py-2 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}
