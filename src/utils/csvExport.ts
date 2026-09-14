import { formatDateShort, formatTime, weekdayLabel } from './time';
import { getShiftLeaderDisplay } from './leader';

const STATUS_LABEL: Record<string, string> = {
  active: 'Angemeldet',
  cancelled: 'Storniert',
  waitlist: 'Warteliste',
};

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[;"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Erstellt den CSV-Inhalt (Abschnitt 44). Semikolon-getrennt, da dies von
 * deutschsprachigem Excel beim Öffnen per Doppelklick automatisch korrekt in
 * Spalten interpretiert wird. UTF-8 mit BOM für korrekte Umlaute in Excel.
 */
export function buildRegistrationsCsv(eventTitle: string, shifts: any[]): string {
  const header = [
    'Veranstaltung',
    'Datum',
    'Wochentag',
    'Schicht',
    'Beginn',
    'Ende',
    'Schichtchef',
    'Vorname',
    'Nachname',
    'Telefon',
    'E-Mail',
    'Status',
    'Bemerkung',
    'Anmeldedatum',
  ];

  const rows: string[][] = [];

  for (const shift of shifts) {
    const leaderName = getShiftLeaderDisplay(shift, shift.leaders).name ?? '';

    for (const reg of shift.registrations) {
      rows.push([
        eventTitle,
        formatDateShort(shift.event_day.date),
        weekdayLabel(shift.event_day.date),
        shift.name,
        formatTime(shift.start_time),
        formatTime(shift.end_time),
        leaderName,
        reg.helper.first_name,
        reg.helper.last_name,
        reg.helper.phone ?? '',
        reg.helper.email ?? '',
        STATUS_LABEL[reg.status] ?? reg.status,
        reg.notes ?? '',
        new Date(reg.created_at).toLocaleString('de-DE'),
      ]);
    }
  }

  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(';'));
  return '﻿' + lines.join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
