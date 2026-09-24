// Zeit-/Datumshilfsfunktionen. Zeiten aus Postgres kommen als "HH:MM:SS".

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Schicht geht über Mitternacht hinaus, wenn die Endzeit nicht nach der Startzeit liegt. */
export function spansMidnight(start: string, end: string): boolean {
  return toMinutes(end) <= toMinutes(start);
}

export function formatTimeRange(start: string, end: string): string {
  const suffix = spansMidnight(start, end) ? ' (über Nacht, endet am Folgetag)' : '';
  return `${formatTime(start)} – ${formatTime(end)} Uhr${suffix}`;
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

/**
 * Dauer in Minuten zwischen zwei "HH:MM:SS"-Zeiten. Geht die Schicht über
 * Mitternacht hinaus (Ende <= Beginn), wird die Endzeit als "Folgetag"
 * behandelt (z.B. 22:00 - 02:00 = 4 Stunden).
 */
export function durationMinutes(start: string, end: string): number {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  return endMin > startMin ? endMin - startMin : 24 * 60 - startMin + endMin;
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
  const aEnd = aStart + durationMinutes(a.start_time, a.end_time);
  const bStart = toMinutes(b.start_time);
  const bEnd = bStart + durationMinutes(b.start_time, b.end_time);

  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);

  if (overlapEnd > overlapStart) {
    const toTime = (mins: number) => {
      const normalized = mins % (24 * 60);
      return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}:00`;
    };
    return { hasOverlap: true, start: toTime(overlapStart), end: toTime(overlapEnd) };
  }
  return { hasOverlap: false, start: null, end: null };
}

export function isRegistrationDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}
