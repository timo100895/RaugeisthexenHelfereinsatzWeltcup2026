import { describe, it, expect } from 'vitest';
import { buildPhotoFileName, sanitizeFileNamePart } from '@/utils/photo';

describe('sanitizeFileNamePart', () => {
  it('wandelt Umlaute und ß um', () => {
    expect(sanitizeFileNamePart('Müller')).toBe('Mueller');
    expect(sanitizeFileNamePart('Schätzle')).toBe('Schaetzle');
    expect(sanitizeFileNamePart('Grießhaber')).toBe('Griesshaber');
  });

  it('entfernt Sonderzeichen und Klammern', () => {
    expect(sanitizeFileNamePart('Rebecca (Lilly)')).toBe('Rebecca_Lilly');
    expect(sanitizeFileNamePart("O'Brien")).toBe('O_Brien');
  });

  it('entfernt sonstige Akzente', () => {
    expect(sanitizeFileNamePart('José')).toBe('Jose');
  });
});

describe('buildPhotoFileName', () => {
  it('baut Vorname_Nachname.jpg (Beispiel aus der Vorgabe)', () => {
    expect(buildPhotoFileName('Max', 'Mustermann', new Set())).toBe('Max_Mustermann.jpg');
  });

  it('hängt bei gleichem Namen eine Nummer an', () => {
    const used = new Set<string>();
    expect(buildPhotoFileName('Max', 'Mustermann', used)).toBe('Max_Mustermann.jpg');
    expect(buildPhotoFileName('Max', 'Mustermann', used)).toBe('Max_Mustermann_2.jpg');
    expect(buildPhotoFileName('max', 'mustermann', used)).toBe('max_mustermann_3.jpg');
  });

  it('fällt bei leerem Namen auf "Foto" zurück', () => {
    expect(buildPhotoFileName('', '', new Set())).toBe('Foto.jpg');
  });
});
