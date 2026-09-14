import { useEffect, useMemo, useState } from 'react';
import { listEvents, listShiftsForEvent, cancelRegistration, promoteFromWaitlist } from '@/services/admin';
import type { EventRow } from '@/types/database';
import { computeOccupancy } from '@/utils/capacity';
import { getShiftLeaderDisplay } from '@/utils/leader';
import { computeOverlap, formatDateLong, formatTimeRange } from '@/utils/time';
import { friendlyErrorMessage } from '@/utils/errors';
import LoadingScreen from '@/components/LoadingScreen';
import HandoverDivider from '@/components/HandoverDivider';
import { ShiftStatusPill } from '@/components/admin/StatusPill';

export default function AdminHelpers() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState<string>('');
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'waitlist' | 'cancelled'>('all');
  const [leaderFilter, setLeaderFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEvents().then((data) => {
      setEvents(data);
      setEventId((data.find((e) => e.status === 'active') ?? data[0])?.id ?? '');
    });
  }, []);

  async function reload() {
    if (!eventId) return;
    setShifts(await listShiftsForEvent(eventId));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const leaderOptions = useMemo(() => {
    if (!shifts) return [];
    const names = new Set<string>();
    for (const s of shifts) {
      const leader = getShiftLeaderDisplay(s, s.leaders);
      if (leader.name) names.add(leader.name);
    }
    return [...names].sort();
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    if (!shifts) return [];
    const term = search.trim().toLowerCase();
    return shifts
      .map((s) => {
        const leaderName = getShiftLeaderDisplay(s, s.leaders).name ?? '';
        if (leaderFilter && leaderName !== leaderFilter) return null;

        let regs = s.registrations;
        if (statusFilter !== 'all') regs = regs.filter((r: any) => r.status === statusFilter);
        if (term) {
          regs = regs.filter((r: any) => {
            const h = r.helper;
            return (
              h.first_name.toLowerCase().includes(term) ||
              h.last_name.toLowerCase().includes(term) ||
              (h.phone ?? '').toLowerCase().includes(term) ||
              (h.email ?? '').toLowerCase().includes(term)
            );
          });
        }
        if ((term || statusFilter !== 'all') && regs.length === 0) return null;
        return { ...s, registrations: statusFilter === 'all' && !term ? s.registrations : regs };
      })
      .filter(Boolean) as any[];
  }, [shifts, search, statusFilter, leaderFilter]);

  async function handleCancel(id: string) {
    if (!window.confirm('Diese Anmeldung wirklich absagen?')) return;
    try {
      await cancelRegistration(id);
      await reload();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function handlePromote(id: string) {
    try {
      await promoteFromWaitlist(id);
      await reload();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  if (events === null) return <LoadingScreen />;

  const days = [...new Set((shifts ?? []).map((s) => s.event_day.date))].sort();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Helferübersicht</h1>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <input
          placeholder="Suche: Name, Telefon, E-Mail"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="waitlist">Warteliste</option>
          <option value="cancelled">Storniert</option>
        </select>
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={leaderFilter}
          onChange={(e) => setLeaderFilter(e.target.value)}
        >
          <option value="">Alle Schichtchefs</option>
          {leaderOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-brand-red">{error}</p>}

      {!shifts ? (
        <LoadingScreen />
      ) : (
        days.map((date) => {
          const dayShifts = filteredShifts
            .filter((s) => s.event_day.date === date)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          if (dayShifts.length === 0) return null;
          return (
            <section key={date}>
              <h2 className="mb-3 text-lg font-bold uppercase tracking-wide">{formatDateLong(date)}</h2>
              <div className="flex flex-col gap-1">
                {dayShifts.map((shift, idx) => {
                  const occ = computeOccupancy(shift, shift.leaders, shift.registrations);
                  const next = dayShifts[idx + 1];
                  const overlap = next ? computeOverlap(shift, next) : null;
                  const leader = getShiftLeaderDisplay(shift, shift.leaders);

                  return (
                    <div key={shift.id}>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{shift.name}</p>
                            <p className="text-gray-600">{formatTimeRange(shift.start_time, shift.end_time)}</p>
                            {leader.name && (
                              <p className="text-sm text-gray-500">Schichtchef: {leader.name}</p>
                            )}
                          </div>
                          <ShiftStatusPill occupancy={occ} shiftStatus={shift.status} />
                        </div>
                        <ul className="mt-3 flex flex-col gap-2">
                          {shift.registrations.map((r: any) => (
                            <li
                              key={r.id}
                              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                                r.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-400 line-through'
                                  : r.status === 'waitlist'
                                    ? 'bg-yellow-50'
                                    : 'bg-brand-gray-light'
                              }`}
                            >
                              <span>
                                {r.helper.first_name} {r.helper.last_name}
                                {r.helper.phone && ` · ${r.helper.phone}`}
                                {r.helper.email && ` · ${r.helper.email}`}
                                {r.status === 'waitlist' && ' · Warteliste'}
                              </span>
                              {r.status !== 'cancelled' && (
                                <span className="flex gap-2">
                                  {r.status === 'waitlist' && (
                                    <button
                                      onClick={() => handlePromote(r.id)}
                                      className="font-semibold text-brand-green-dark underline"
                                    >
                                      Nachrücken
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleCancel(r.id)}
                                    className="font-semibold text-brand-red underline"
                                  >
                                    Absagen
                                  </button>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {overlap?.hasOverlap && overlap.start && overlap.end && (
                        <HandoverDivider start={overlap.start} end={overlap.end} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
