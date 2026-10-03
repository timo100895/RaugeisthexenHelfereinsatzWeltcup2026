// Hilfsfunktionen rund um das Foto für die Akkreditierung.

/** Vorgabetext für neue Veranstaltungen (identisch mit dem Spalten-Default in Migration 0016). */
export const DEFAULT_PHOTO_HINT = `Für jede Helferin und jeden Helfer wird ein aktuelles Foto benötigt – auch wenn in den vergangenen Jahren schon eine Akkreditierung vorhanden war. Ältere Fotos sind nicht mehr aktuell.

Bitte achte bei der Aufnahme auf Folgendes:
• einfarbiger, möglichst neutraler Hintergrund
• Gesicht gerade und frontal zur Kamera, kein seitliches Foto
• keine Kopfbedeckung oder Sonnenbrille
• Kopf und Hals müssen vollständig im Bildausschnitt sein
• gute Bildqualität und ausreichende Beleuchtung

Du musst die Datei nicht umbenennen – die Zuordnung zu deinem Namen erfolgt automatisch.`;

export const PHOTO_MAX_DIMENSION = 1200;
export const PHOTO_MIN_DIMENSION = 300;
export const PHOTO_JPEG_QUALITY = 0.88;

/**
 * Skaliert ein vom Nutzer gewähltes Bild (z.B. 12-Megapixel-Handyfoto) auf
 * maximal 1200 px Kantenlänge und wandelt es in ein JPEG um. Das hält den
 * Upload klein und schnell und sorgt dafür, dass serverseitig immer ein
 * JPEG ankommt.
 */
export async function compressImageToJpeg(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('INVALID_FILE');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      el.src = url;
    });

    const { naturalWidth, naturalHeight } = img;
    if (Math.min(naturalWidth, naturalHeight) < PHOTO_MIN_DIMENSION) {
      throw new Error('IMAGE_TOO_SMALL');
    }

    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('IMAGE_DECODE_FAILED');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY)
    );
    if (!blob) throw new Error('IMAGE_DECODE_FAILED');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const UMLAUTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};

/** Macht aus einem Namensteil einen dateinamentauglichen Text ("Müller" -> "Mueller"). */
export function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[äöüÄÖÜß]/g, (ch) => UMLAUTS[ch])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Erzeugt den Dateinamen "Vorname_Nachname.jpg" (z.B. Max_Mustermann.jpg). Gibt
 * es den Namen schon (zwei Personen mit gleichem Namen), wird _2, _3 ...
 * angehängt. "used" sammelt die bereits vergebenen Namen.
 */
export function buildPhotoFileName(firstName: string, lastName: string, used: Set<string>): string {
  const base =
    [sanitizeFileNamePart(firstName), sanitizeFileNamePart(lastName)].filter(Boolean).join('_') || 'Foto';

  let candidate = `${base}.jpg`;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter}.jpg`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}
