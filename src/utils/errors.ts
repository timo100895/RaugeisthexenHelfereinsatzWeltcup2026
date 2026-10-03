// Übersetzt technische Supabase-/Postgres-Fehler in verständliche,
// benutzerfreundliche deutsche Meldungen (siehe Aufgabenstellung Abschnitt 80).

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
}

const MESSAGE_MAP: Record<string, string> = {
  SHIFT_FULL: 'Diese Schicht wurde leider gerade vollständig belegt.',
  SHIFT_CLOSED: 'Diese Schicht ist derzeit nicht für Anmeldungen geöffnet.',
  SHIFT_NOT_FOUND: 'Diese Schicht wurde nicht gefunden. Bitte lade die Seite neu.',
  MISSING_NAME: 'Bitte gib deinen Vor- und Nachnamen an.',
  MISSING_CONTACT: 'Bitte gib mindestens eine E-Mail-Adresse oder eine Telefonnummer an.',
  MISSING_EMAIL: 'Für diese Veranstaltung ist eine E-Mail-Adresse Pflicht.',
  FILE_TOO_LARGE: 'Das Foto ist zu groß. Bitte wähle ein kleineres Bild.',
  INVALID_FILE: 'Diese Datei konnte nicht als Foto verarbeitet werden. Bitte wähle ein anderes Bild.',
  IMAGE_DECODE_FAILED: 'Dieses Bild konnte nicht gelesen werden. Bitte wähle ein JPEG- oder PNG-Foto.',
  IMAGE_TOO_SMALL: 'Das Foto ist zu klein (mindestens 300 Pixel an der kürzeren Seite). Bitte wähle ein Bild mit besserer Auflösung.',
  STORAGE_ERROR: 'Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut.',
  UPLOAD_FAILED: 'Das Foto konnte nicht hochgeladen werden. Bitte prüfe deine Internetverbindung und versuche es erneut.',
  NO_SHIFTS_SELECTED: 'Bitte wähle mindestens eine Schicht aus.',
  INVALID_TOKEN: 'Dieser Link ist ungültig oder abgelaufen.',
  REGISTRATION_NOT_FOUND: 'Diese Anmeldung wurde nicht gefunden.',
  FORBIDDEN: 'Du hast keine Berechtigung für diese Aktion.',
  already_registered: 'Du bist bereits für diese Schicht angemeldet.',
};

export function friendlyErrorMessage(error: unknown): string {
  if (!error) return 'Es ist ein unbekannter Fehler aufgetreten.';

  const err = error as SupabaseLikeError;
  const raw = err.message ?? String(error);

  for (const key of Object.keys(MESSAGE_MAP)) {
    if (raw.includes(key)) return MESSAGE_MAP[key];
  }

  if (raw.includes('duplicate key') || err.code === '23505') {
    return 'Du bist bereits für diese Schicht angemeldet.';
  }

  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return 'Keine Verbindung zum Server möglich. Bitte prüfe deine Internetverbindung und versuche es erneut.';
  }

  return 'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.';
}

export function resultStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Erfolgreich angemeldet';
    case 'waitlist':
      return 'Auf Warteliste eingetragen';
    case 'full':
      return 'Leider bereits voll belegt';
    case 'closed':
      return 'Schicht ist geschlossen';
    case 'already_registered':
      return 'Bereits angemeldet';
    case 'registration_closed':
      return 'Anmeldung ist geschlossen';
    case 'not_found':
      return 'Schicht nicht gefunden';
    default:
      return status;
  }
}
