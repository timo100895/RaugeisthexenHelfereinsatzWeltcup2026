import { buildPhotoFileName } from './photo';

export interface AccreditationPerson {
  helperId: string;
  firstName: string;
  lastName: string;
  /** Pfad im privaten Storage-Bucket, null wenn kein Foto vorliegt. */
  photoPath: string | null;
  /** Dateiname im Export, z.B. "Max_Mustermann.jpg"; null wenn kein Foto vorliegt. */
  photoFileName: string | null;
}

export interface PhotoHelper {
  id: string;
  firstName: string;
  lastName: string;
  photoPath: string;
  photoUploadedAt: string | null;
}

/**
 * Alle Helfer-Datensätze mit hinterlegtem Foto, die in dieser Veranstaltung
 * mindestens eine Anmeldung haben (egal ob aktiv, Warteliste oder storniert) -
 * Grundlage zum Löschen der Fotos nach der Veranstaltung. Hier wird bewusst
 * NICHT nach Namen zusammengeführt: jeder Datensatz hat sein eigenes Foto.
 */
export function collectPhotoHelpers(shifts: any[]): PhotoHelper[] {
  const byId = new Map<string, PhotoHelper>();
  for (const shift of shifts) {
    for (const reg of shift.registrations ?? []) {
      const helper = reg.helper;
      if (!helper?.photo_path || byId.has(helper.id)) continue;
      byId.set(helper.id, {
        id: helper.id,
        firstName: helper.first_name,
        lastName: helper.last_name,
        photoPath: helper.photo_path,
        photoUploadedAt: helper.photo_uploaded_at ?? null,
      });
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, 'de', { sensitivity: 'base' }) ||
      a.firstName.localeCompare(b.firstName, 'de', { sensitivity: 'base' })
  );
}

function nameKey(first: string, last: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(first)}|${norm(last)}`;
}

/**
 * Sammelt alle Personen mit mindestens einer aktiven Anmeldung (in nicht
 * abgesagten Schichten) für die Akkreditierungsliste.
 *
 * Jede Anmeldung legt in der Datenbank einen eigenen Helfer-Datensatz an;
 * dieselbe Person kann daher mehrfach vorkommen. Sie wird hier über Vor- und
 * Nachnamen (ohne Beachtung von Groß-/Kleinschreibung) zu EINER Zeile
 * zusammengeführt. Liegen mehrere Fotos vor, gilt das zuletzt hochgeladene.
 *
 * "shifts" ist das Ergebnis von listShiftsForEvent().
 */
export function collectAccreditationPersons(shifts: any[]): AccreditationPerson[] {
  const byName = new Map<string, any>();

  for (const shift of shifts) {
    if (shift.status === 'cancelled') continue;
    for (const reg of shift.registrations ?? []) {
      if (reg.status !== 'active' || !reg.helper) continue;
      const helper = reg.helper;
      const key = nameKey(helper.first_name, helper.last_name);
      const current = byName.get(key);

      if (!current) {
        byName.set(key, helper);
        continue;
      }

      const currentHasPhoto = Boolean(current.photo_path);
      const candidateHasPhoto = Boolean(helper.photo_path);
      const candidateIsNewer =
        candidateHasPhoto &&
        (!currentHasPhoto ||
          new Date(helper.photo_uploaded_at ?? 0).getTime() >
            new Date(current.photo_uploaded_at ?? 0).getTime());
      if (candidateIsNewer) byName.set(key, helper);
    }
  }

  const sorted = [...byName.values()].sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name, 'de', { sensitivity: 'base' }) ||
      a.first_name.localeCompare(b.first_name, 'de', { sensitivity: 'base' })
  );

  const usedFileNames = new Set<string>();
  return sorted.map((helper) => ({
    helperId: helper.id,
    firstName: helper.first_name.trim(),
    lastName: helper.last_name.trim(),
    photoPath: helper.photo_path ?? null,
    photoFileName: helper.photo_path
      ? buildPhotoFileName(helper.first_name, helper.last_name, usedFileNames)
      : null,
  }));
}
