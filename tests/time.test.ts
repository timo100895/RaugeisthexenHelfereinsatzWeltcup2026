import { describe, it, expect } from 'vitest';
import { computeOverlap, durationMinutes, formatDuration, formatTimeRange, weekdayLabel } from '@/utils/time';

describe('computeOverlap', () => {
  it('erkennt die Übergabe zwischen Freitag Schicht 1 und Schicht 2 (Weltcup-Beispiel)', () => {
    const a = { start_time: '11:00:00', end_time: '15:15:00' };
    const b = { start_time: '15:00:00', end_time: '19:15:00' };
    const result = computeOverlap(a, b);
    expect(result.hasOverlap).toBe(true);
    expect(result.start).toBe('15:00:00');
    expect(result.end).toBe('15:15:00');
  });

  it('erkennt Samstag-Überschneidung (13:30-13:45)', () => {
    const a = { start_time: '09:00:00', end_time: '13:45:00' };
    const b = { start_time: '13:30:00', end_time: '18:15:00' };
    const result = computeOverlap(a, b);
    expect(result.hasOverlap).toBe(true);
    expect(result.start).toBe('13:30:00');
    expect(result.end).toBe('13:45:00');
  });

  it('meldet keine Überschneidung bei aufeinanderfolgenden, nicht überlappenden Schichten', () => {
    const a = { start_time: '09:00:00', end_time: '12:00:00' };
    const b = { start_time: '12:00:00', end_time: '15:00:00' };
    const result = computeOverlap(a, b);
    expect(result.hasOverlap).toBe(false);
  });
});

describe('durationMinutes / formatDuration', () => {
  it('berechnet 4 Stunden 15 Minuten für 11:00-15:15', () => {
    const minutes = durationMinutes('11:00:00', '15:15:00');
    expect(minutes).toBe(255);
    expect(formatDuration(minutes)).toBe('4 Stunden 15 Minuten');
  });
});

describe('formatTimeRange', () => {
  it('formatiert HH:MM:SS zu "HH:MM – HH:MM Uhr"', () => {
    expect(formatTimeRange('11:00:00', '15:15:00')).toBe('11:00 – 15:15 Uhr');
  });
});

describe('weekdayLabel', () => {
  it('gibt den korrekten Wochentag für 2026-12-11 (Freitag) zurück', () => {
    expect(weekdayLabel('2026-12-11')).toBe('Freitag');
  });
  it('gibt den korrekten Wochentag für 2026-12-13 (Sonntag) zurück', () => {
    expect(weekdayLabel('2026-12-13')).toBe('Sonntag');
  });
});
