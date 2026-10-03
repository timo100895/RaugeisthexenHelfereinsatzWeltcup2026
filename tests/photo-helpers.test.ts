import { describe, it, expect } from 'vitest';
import { collectPhotoHelpers } from '@/utils/accreditation';

function helper(id: string, first: string, last: string, path: string | null) {
  return { id, first_name: first, last_name: last, photo_path: path, photo_uploaded_at: null };
}

describe('collectPhotoHelpers', () => {
  const shifts = [
    {
      registrations: [
        { status: 'active', helper: helper('h1', 'Max', 'Mustermann', 'h1.jpg') },
        { status: 'cancelled', helper: helper('h2', 'Anna', 'Beispiel', 'h2.jpg') },
        { status: 'waitlist', helper: helper('h3', 'Warte', 'Liste', null) },
      ],
    },
    {
      registrations: [
        // derselbe Datensatz in einer zweiten Schicht darf nur einmal vorkommen
        { status: 'active', helper: helper('h1', 'Max', 'Mustermann', 'h1.jpg') },
      ],
    },
  ];

  it('liefert jeden Datensatz mit Foto genau einmal - auch bei stornierten Anmeldungen', () => {
    const result = collectPhotoHelpers(shifts);
    expect(result.map((h) => h.id)).toEqual(['h2', 'h1']);
  });

  it('lässt Datensätze ohne Foto weg und sortiert nach Nachname', () => {
    const result = collectPhotoHelpers(shifts);
    expect(result.find((h) => h.id === 'h3')).toBeUndefined();
    expect(result[0].lastName).toBe('Beispiel');
  });
});
