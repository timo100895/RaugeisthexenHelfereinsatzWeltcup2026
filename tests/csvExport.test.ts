import { describe, it, expect } from 'vitest';
import { buildRegistrationsCsv } from '@/utils/csvExport';

const sampleShifts = [
  {
    name: 'Schicht 1',
    start_time: '11:00:00',
    end_time: '15:15:00',
    event_day: { date: '2026-12-11' },
    leaders: [
      {
        is_primary: true,
        board_member: { first_name: 'Max', last_name: 'Mustermann' },
      },
    ],
    registrations: [
      {
        status: 'active',
        notes: null,
        created_at: '2026-01-01T10:00:00Z',
        helper: { first_name: 'Anna', last_name: 'Beispiel', phone: '0171', email: 'anna@example.com' },
      },
    ],
  },
];

describe('buildRegistrationsCsv', () => {
  it('enthält alle in Abschnitt 44 geforderten Spalten', () => {
    const csv = buildRegistrationsCsv('Weltcup Skispringen 2026', sampleShifts);
    const [header] = csv.replace('﻿', '').split('\r\n');
    const columns = header.split(';');
    expect(columns).toEqual([
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
    ]);
  });

  it('enthält die Helferdaten in der Datenzeile', () => {
    const csv = buildRegistrationsCsv('Weltcup Skispringen 2026', sampleShifts);
    expect(csv).toContain('Anna');
    expect(csv).toContain('Beispiel');
    expect(csv).toContain('Max Mustermann');
    expect(csv).toContain('Angemeldet');
  });

  it('beginnt mit einem UTF-8 BOM für korrekte Umlaute in Excel', () => {
    const csv = buildRegistrationsCsv('Weltcup Skispringen 2026', sampleShifts);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
