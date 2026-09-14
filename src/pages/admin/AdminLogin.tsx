import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import Logo from '@/components/Logo';

export default function AdminLogin() {
  const { session, signInWithPassword, signInWithMagicLink } = useAuth();
  const { settings } = useSettings();
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to="/admin" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (mode === 'password') {
      const err = await signInWithPassword(email.trim(), password);
      if (err) setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
    } else {
      const err = await signInWithMagicLink(email.trim());
      if (err) setError('Der Link konnte nicht versendet werden.');
      else setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-black p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size={64} />
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            {settings.org_name}
          </p>
          <h1 className="text-xl font-bold">Adminbereich</h1>
        </div>

        {sent ? (
          <p className="rounded-xl bg-brand-green/10 p-4 text-center text-brand-green-dark">
            Ein Anmeldelink wurde an {email} gesendet. Bitte prüfe dein Postfach.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">E-Mail-Adresse</span>
              <input
                type="email"
                required
                className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>

            {mode === 'password' && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Passwort</span>
                <input
                  type="password"
                  required
                  className="rounded-xl border border-gray-300 px-4 py-3 focus-ring"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
            )}

            {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="focus-ring rounded-xl bg-brand-red py-3 font-bold text-white disabled:opacity-60"
            >
              {loading ? 'Bitte warten …' : mode === 'password' ? 'Anmelden' : 'Link anfordern'}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
              className="text-sm text-gray-500 underline"
            >
              {mode === 'password' ? 'Stattdessen per Magic Link anmelden' : 'Stattdessen mit Passwort anmelden'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
