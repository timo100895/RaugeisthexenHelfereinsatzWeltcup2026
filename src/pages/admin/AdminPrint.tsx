import { useEffect, useMemo, useState } from 'react';
import { listEvents, listShiftsForEvent } from '@/services/admin';
import { useSettings } from '@/context/SettingsContext';
import type { EventRow } from '@/types/database';
import { computeOverlap, formatDateLong, formatTimeRange } from '@/utils/time';
import LoadingScreen from '@/components/LoadingScreen';
import Logo from '@/components/Logo';

export default function AdminPrint() {
  const { settings } = useSettings();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [shifts, setShifts] = useState<any[] | null>(null);

  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [showLeaderContact, setShowLeaderContact] = useState(false);

  useEffect(() => {
    listEvents().then((data) => {
      setEvents(data);
      setEventId((data.find((e) => e.status === 'active') ?? data[0])?.id ?? '');
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    listShiftsForEvent(eventId).then(setShifts);
  }, [eventId]);

  const days = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of shifts ?? []) {
      if (!map.has(s.event_day.date)) map.set(s.event_day.date, []);
      map.get(s.event_day.date)!.push(s);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shifts]);

  if (events === null) return <LoadingScreen />;
  const event = events.find((e) => e.id === eventId);

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4">
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
          Telefonnummern anzeigen
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />
          E-Mail-Adressen anzeigen
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} />
          Bemerkungen anzeigen
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showLeaderContact}
            onChange={(e) => setShowLeaderContact(e.target.checked)}
          />
          Schichtchef-Kontaktdaten anzeigen
        </label>
        <button
          onClick={() => window.print()}
          className="ml-auto rounded-xl bg-brand-red px-5 py-3 font-semibold text-white"
        >
          Drucken / Als PDF speichern
        </button>
      </div>

      {!event || !shifts ? (
        <LoadingScreen />
      ) : (
        <div className="print-page mx-auto mt-6 max-w-3xl bg-white p-6 print:mt-0 print:max-w-none print:p-0">
          <div className="print-header mb-6 flex items-center gap-4 pb-4">
            <Logo size={56} />
            <div>
              <p className="text-sm font-semibold uppercase text-gray-500">{settings.org_name}</p>
              <h1 className="text-xl font-bold">{event.title}</h1>
              <p className="text-gray-500">Helferplan</p>
            </div>
          </div>

          {days.map(([date, dayShifts]) => (
            <div key={date} className="print-day mb-8">
              <h2 className="mb-3 border-b-2 border-black pb-1 text-lg font-bold uppercase">
                {formatDateLong(date)}
              </h2>
              {dayShifts.map((shift, idx) => {
                const primary = shift.leaders.find((l: any) => l.is_primary);
                const others = shift.leaders.filter((l: any) => !l.is_primary);
                const activeHelpers = shift.registrations.filter((r: any) => r.status === 'active');
                const next = dayShifts[idx + 1];
                const overlap = next ? computeOverlap(shift, next) : null;

                return (
                  <div key={shift.id}>
                    <div className="print-shift mb-3 rounded-xl border border-gray-300 p-4">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-base font-bold">{shift.name}</h3>
                        <span className="text-gray-700">{formatTimeRange(shift.start_time, shift.end_time)}</span>
                      </div>

                      {primary && (
                        <p className="mt-2 text-sm">
                          <strong>Schichtchef:</strong> {primary.board_member.first_name}{' '}
                          {primary.board_member.last_name}
                          {showLeaderContact && primary.board_member.phone && ` · ${primary.board_member.phone}`}
                          {showLeaderContact && primary.board_member.email && ` · ${primary.board_member.email}`}
                        </p>
                      )}
                      {others.map((l: any) => (
                        <p key={l.id} className="text-sm">
                          Weitere/r Verantwortliche/r: {l.board_member.first_name} {l.board_member.last_name}
                        </p>
                      ))}

                      <table className="mt-2 w-full text-sm">
                        <tbody>
                          {activeHelpers.length === 0 && (
                            <tr>
                              <td className="py-1 text-gray-500">Noch keine Helfer eingetragen</td>
                            </tr>
                          )}
                          {activeHelpers.map((r: any, i: number) => (
                            <tr key={r.id}>
                              <td className="w-6 py-1 align-top">{i + 1}.</td>
                              <td className="py-1">
                                {r.helper.first_name} {r.helper.last_name}
                                {showPhone && r.helper.phone && ` · ${r.helper.phone}`}
                                {showEmail && r.helper.email && ` · ${r.helper.email}`}
                                {showNotes && r.notes && (
                                  <span className="text-gray-500"> ({r.notes})</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {overlap?.hasOverlap && overlap.start && overlap.end && (
                      <div className="mb-3 rounded-lg border border-dashed border-gray-400 p-2 text-center text-sm font-semibold uppercase tracking-wide text-gray-600">
                        Übergabe · {formatTimeRange(overlap.start, overlap.end)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
