// @vitest-environment node
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { collectAccreditationPersons } from '@/utils/accreditation';
import { buildAccreditationWorkbook } from '@/utils/accreditationExport';

function helper(id: string, first: string, last: string, photo?: { path: string; at: string }) {
  return {
    id,
    first_name: first,
    last_name: last,
    photo_path: photo?.path ?? null,
    photo_uploaded_at: photo?.at ?? null,
  };
}

function reg(status: string, h: ReturnType<typeof helper>) {
  return { status, helper: h };
}

const shifts = [
  {
    status: 'open',
    registrations: [
      reg('active', helper('h1', 'Max', 'Mustermann', { path: 'h1.jpg', at: '2026-10-01T10:00:00Z' })),
      reg('active', helper('h2', 'Anna', 'Beispiel')),
      reg('cancelled', helper('h3', 'Storniert', 'Person')),
      reg('waitlist', helper('h4', 'Warte', 'Liste')),
    ],
  },
  {
    status: 'open',
    registrations: [
      // gleiche Person (anderer Datensatz, andere Schreibweise) mit neuerem Foto
      reg('active', helper('h5', ' max ', 'MUSTERMANN', { path: 'h5.jpg', at: '2026-10-05T10:00:00Z' })),
    ],
  },
  {
    status: 'cancelled',
    registrations: [reg('active', helper('h6', 'Abgesagte', 'Schicht'))],
  },
];

describe('collectAccreditationPersons', () => {
  const persons = collectAccreditationPersons(shifts);

  it('nimmt nur aktive Anmeldungen in nicht abgesagten Schichten auf', () => {
    expect(persons.map((p) => `${p.firstName} ${p.lastName}`)).toEqual(['Anna Beispiel', 'max MUSTERMANN']);
  });

  it('führt Mehrfachanmeldungen derselben Person zusammen und nimmt das neuere Foto', () => {
    const max = persons.find((p) => p.lastName.toLowerCase() === 'mustermann')!;
    expect(persons.filter((p) => p.lastName.toLowerCase() === 'mustermann')).toHaveLength(1);
    expect(max.photoPath).toBe('h5.jpg');
    expect(max.photoFileName).toBe('max_MUSTERMANN.jpg');
  });

  it('sortiert nach Nachname und markiert fehlende Fotos', () => {
    expect(persons[0].lastName).toBe('Beispiel');
    expect(persons[0].photoPath).toBeNull();
    expect(persons[0].photoFileName).toBeNull();
  });
});

describe('buildAccreditationWorkbook', () => {
  it('erzeugt das Layout der Vorlage', async () => {
    const buffer = await buildAccreditationWorkbook({
      title: 'FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026',
      ressort: 'Bewirtung',
      verein: 'Ornemer Raugeisthexen',
      funktion: 'Arbeitseinsatz Bewirtungsstand Ski Club',
      persons: [
        {
          helperId: 'a',
          firstName: 'Max',
          lastName: 'Mustermann',
          photoPath: 'a.jpg',
          photoFileName: 'Max_Mustermann.jpg',
        },
        { helperId: 'b', firstName: 'Anna', lastName: 'Beispiel', photoPath: null, photoFileName: null },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.getCell('A1').value).toBe('FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026');
    expect(String(sheet.getCell('A2').text)).toBe('Name Ressort: Bewirtung');
    expect(String(sheet.getCell('A3').text)).toBe('Verein: Ornemer Raugeisthexen');

    expect(['A5', 'B5', 'C5', 'D5'].map((a) => sheet.getCell(a).value)).toEqual([
      'Vorname',
      'Name',
      'Funktion',
      'Bild',
    ]);

    expect(['A6', 'B6', 'C6', 'D6'].map((a) => sheet.getCell(a).value)).toEqual([
      'Max',
      'Mustermann',
      'Arbeitseinsatz Bewirtungsstand Ski Club',
      'Max_Mustermann.jpg',
    ]);
    expect(sheet.getCell('D7').value).toBe('FOTO FEHLT');
    expect(sheet.getRow(6).height).toBeGreaterThanOrEqual(90);
  });
});
