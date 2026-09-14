// Zeit-/Datumshilfsfunktionen. Zeiten aus Postgres kommen als "HH:MM:SS".

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)} Uhr`;
}

const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function parseDate(dateStr: string): Date {
  // "YYYY-MM-DD" als lokales Datum interpretieren (nicht UTC), um
  // Zeitzonen-Verschiebungen um einen Tag zu vermeiden.
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLong(dateStr: string): string {
  const d = parseDate(dateStr);
  const weekday = WEEKDAYS_LONG[d.getDay()];
  return `${weekday}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function formatDateShort(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function weekdayLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  return WEEKDAYS_LONG[d.getDay()];
}

export function weekdayShort(dateStr: string): string {
  const d = parseDate(dateStr);
  return WEEKDAYS_SHORT[d.getDay()];
}

/** Dauer in Minuten zwischen zwei "HH:MM:SS"-Zeiten (end > start vorausgesetzt). */
export function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} Stunde${h === 1 ? '' : 'n'}`;
  return `${h} Stunde${h === 1 ? '' : 'n'} ${m} Minuten`;
}

export function formatHoursDecimal(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export interface OverlapResult {
  hasOverlap: boolean;
  start: string | null;
  end: string | null;
}

/** Berechnet die Übergabezeit zwischen zwei zeitlich aufeinanderfolgenden Schichten am selben Tag. */
export function computeOverlap(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string }
): OverlapResult {
  const aStart = toMinutes(a.start_time);
  const aEnd = toMinutes(a.end_time);
  const bStart = toMinutes(b.start_time);
  const bEnd = toMinutes(b.end_time);

  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);

  if (overlapEnd > overlapStart) {
    const toTime = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`;
    return { hasOverlap: true, start: toTime(overlapStart), end: toTime(overlapEnd) };
  }
  return { hasOverlap: false, start: null, end: null };
}

export function isRegistrationDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}
