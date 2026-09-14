import { describe, it, expect } from 'vitest';
import { friendlyErrorMessage, resultStatusLabel } from '@/utils/errors';

describe('friendlyErrorMessage', () => {
  it('übersetzt SHIFT_FULL in eine verständliche Meldung (Abschnitt 80)', () => {
    expect(friendlyErrorMessage({ message: 'SHIFT_FULL' })).toBe(
      'Diese Schicht wurde leider gerade vollständig belegt.'
    );
  });

  it('übersetzt Postgres unique_violation in eine verständliche Meldung', () => {
    expect(friendlyErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(
      'Du bist bereits für diese Schicht angemeldet.'
    );
  });

  it('gibt eine generische Meldung für unbekannte Fehler zurück', () => {
    expect(friendlyErrorMessage({ message: 'irgendein interner Fehler xyz' })).toBe(
      'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'
    );
  });
});

describe('resultStatusLabel', () => {
  it('liefert ein deutsches Label für "full"', () => {
    expect(resultStatusLabel('full')).toBe('Leider bereits voll belegt');
  });
});
