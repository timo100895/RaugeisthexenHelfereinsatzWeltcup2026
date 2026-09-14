import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import Logo from '@/components/Logo';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/heute', label: 'Heute' },
  { to: '/admin/veranstaltungen', label: 'Veranstaltungen' },
  { to: '/admin/vorstand', label: 'Vorstand / Verantwortliche' },
  { to: '/admin/helfer', label: 'Helferübersicht' },
  { to: '/admin/auswertungen', label: 'Auswertungen' },
  { to: '/admin/export', label: 'Export' },
  { to: '/admin/druck', label: 'Druckansicht' },
  { to: '/admin/einstellungen', label: 'Einstellungen' },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const { settings } = useSettings();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-brand-black px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="focus-ring rounded p-1 md:hidden"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menü"
          >
            ☰
          </button>
          <Logo size={32} className="rounded bg-white p-0.5" />
          <span className="font-bold">{settings.org_name} · Admin</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-gray-300">
            {profile?.display_name ?? profile?.role}
          </span>
          <button onClick={signOut} className="focus-ring rounded border border-gray-500 px-3 py-1.5">
            Abmelden
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <nav
          className={`no-print z-20 w-64 shrink-0 border-r border-gray-200 bg-white px-3 py-4 md:sticky md:top-[57px] md:block md:h-[calc(100vh-57px)] ${
            navOpen ? 'fixed inset-0 top-[57px] block bg-white' : 'hidden'
          }`}
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    `focus-ring block rounded-xl px-4 py-3 font-medium ${
                      isActive ? 'bg-brand-red text-white' : 'text-gray-700 hover:bg-brand-gray-light'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
