import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useSettings } from '@/context/SettingsContext';
import type { EventRow } from '@/types/database';
import { formatDateShort } from '@/utils/time';
import Logo from '@/components/Logo';
import LoadingScreen from '@/components/LoadingScreen';

export default function HomePage() {
  const { settings } = useSettings();
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .order('start_date', { ascending: true })
      .then(({ data }) => setEvents((data as EventRow[]) ?? []));
  }, []);

  if (events === null) return <LoadingScreen />;

  if (events.length === 1) {
    return <Navigate to={`/veranstaltung/${events[0].slug}`} replace />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white">
      <header className="flex flex-col items-center gap-4 bg-brand-black px-4 py-10 text-center text-white">
        <Logo size={96} className="rounded bg-white p-2" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            {settings.org_name}
          </p>
          <h1 className="text-2xl font-bold">Helfereinteilung</h1>
        </div>
      </header>

      <div className="p-4">
        {events.length === 0 ? (
          <p className="text-center text-gray-500">
            Aktuell ist keine Veranstaltung für die Helferanmeldung geöffnet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="mb-2 font-semibold">Aktuelle Veranstaltungen</p>
            {events.map((e) => (
              <Link
                key={e.id}
                to={`/veranstaltung/${e.slug}`}
                className="focus-ring rounded-2xl border border-gray-200 p-4 hover:border-brand-red/50 hover:shadow-sm"
              >
                <p className="text-lg font-bold">{e.title}</p>
                <p className="text-gray-500">
                  {formatDateShort(e.start_date)} – {formatDateShort(e.end_date)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
