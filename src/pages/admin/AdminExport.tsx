import { useEffect, useMemo, useState } from 'react';
import { listEvents, listShiftsForEvent } from '@/services/admin';
import type { EventRow } from '@/types/database';
import { getShiftLeaderDisplay } from '@/utils/leader';
import { formatDateLong } from '@/utils/time';
import { buildRegistrationsCsv, downloadTextFile } from '@/utils/csvExport';
import { buildEventWorkbook, downloadBlob } from '@/utils/xlsxExport';
import LoadingScreen from '@/components/LoadingScreen';

export default function AdminExport() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [dayFilter, setDayFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [leaderFilter, setLeaderFilter] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listEvents().then((data) => {
      setEvents(data);
      setEventId((data.find((e) => e.status === 'active') ?? data[0])?.id ?? '');
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    listShiftsForEvent(eventId).then(setShifts);
    setDayFilter('');
    setShiftFilter('');
    setLeaderFilter('');
  }, [eventId]);

  const days = useMemo(() => [...new Set((shifts ?? []).map((s) => s.event_day.date))].sort(), [shifts]);
  const leaderOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of shifts ?? []) {
      const name = getShiftLeaderDisplay(s, s.leaders).name;
      if (name) names.add(name);
    }
    return [...names].sort();
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    if (!shifts) return [];
    return shifts.filter((s) => {
      if (dayFilter && s.event_day.date !== dayFilter) return false;
      if (shiftFilter && s.id !== shiftFilter) return false;
      if (leaderFilter) {
        const name = getShiftLeaderDisplay(s, s.leaders).name ?? '';
        if (name !== leaderFilter) return false;
      }
      return true;
    });
  }, [shifts, dayFilter, shiftFilter, leaderFilter]);

  if (events === null) return <LoadingScreen />;

  const event = events.find((e) => e.id === eventId);

  async function exportCsv() {
    if (!event) return;
    const csv = buildRegistrationsCsv(event.title, filteredShifts);
    downloadTextFile(`Helferliste_${event.slug}.csv`, csv, 'text/csv;charset=utf-8');
  }

  async function exportXlsx() {
    if (!event) return;
    setBusy(true);
    try {
      const blob = await buildEventWorkbook(event.title, filteredShifts);
      downloadBlob(`Helferplan_Raugeisthexen_${event.slug}.xlsx`, blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Export</h1>

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
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
        >
          <option value="">Gesamte Veranstaltung</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {formatDateLong(d)}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value)}
        >
          <option value="">Alle Schichten</option>
          {(shifts ?? [])
            .filter((s) => !dayFilter || s.event_day.date === dayFilter)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateLong(s.event_day.date)} · {s.name}
              </option>
            ))}
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

      <p className="text-sm text-gray-500">
        {filteredShifts.length} Schicht(en) im Export enthalten (
        {filteredShifts.reduce((sum, s) => sum + s.registrations.length, 0)} Anmeldungen inkl. Absagen).
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={exportCsv}
          disabled={!shifts}
          className="rounded-xl bg-brand-black px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          CSV exportieren
        </button>
        <button
          onClick={exportXlsx}
          disabled={!shifts || busy}
          className="rounded-xl bg-brand-red px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Erzeuge Excel-Datei …' : 'Excel (XLSX) exportieren'}
        </button>
      </div>
    </div>
  );
}
