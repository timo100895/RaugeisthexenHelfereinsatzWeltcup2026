import ExcelJS from 'exceljs';
import type { AccreditationPerson } from './accreditation';

export interface AccreditationSheetOptions {
  /** Kopfzeile, z.B. "FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026" */
  title: string;
  ressort: string;
  verein: string;
  /** Text der Spalte "Funktion" (für alle Personen gleich) */
  funktion: string;
  persons: AccreditationPerson[];
}

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT_NAME = 'Arial';

/**
 * Erzeugt die Akkreditierungsliste im vorgegebenen Layout:
 *
 *   FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026
 *   Name Ressort:
 *   Verein:
 *
 *   | Vorname | Name | Funktion | Bild |
 *
 * Die Spalte "Bild" enthält den Dateinamen des Fotos (z.B. Max_Mustermann.jpg),
 * unter dem es im Foto-Download liegt. Die Zeilen sind hoch angelegt wie in der
 * Vorlage.
 */
export async function buildAccreditationWorkbook(opts: AccreditationSheetOptions): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Helfereinteilung Ornemer Raugeisthexen';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Akkreditierungsliste');
  sheet.columns = [{ width: 20 }, { width: 20 }, { width: 62 }, { width: 28 }];

  const title = sheet.getCell('A1');
  title.value = opts.title;
  title.font = { name: FONT_NAME, size: 13, bold: true };

  const labelled = (address: string, label: string, value: string) => {
    sheet.getCell(address).value = {
      richText: [
        { font: { name: FONT_NAME, size: 11, bold: true }, text: `${label} ` },
        { font: { name: FONT_NAME, size: 11 }, text: value },
      ],
    };
  };
  labelled('A2', 'Name Ressort:', opts.ressort);
  labelled('A3', 'Verein:', opts.verein);

  const headerRow = sheet.getRow(5);
  ['Vorname', 'Name', 'Funktion', 'Bild'].forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { name: FONT_NAME, size: 11, bold: true };
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle' };
  });
  headerRow.height = 22;

  opts.persons.forEach((person, index) => {
    const row = sheet.getRow(6 + index);
    row.height = 100;

    const values = [person.firstName, person.lastName, opts.funktion, person.photoFileName ?? 'FOTO FEHLT'];
    values.forEach((value, col) => {
      const cell = row.getCell(col + 1);
      cell.value = value;
      cell.border = BORDER;
      cell.alignment = { vertical: 'bottom', horizontal: 'left', wrapText: true };
      cell.font =
        col === 3 && !person.photoFileName
          ? { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FFC81E1E' } }
          : { name: FONT_NAME, size: 11 };
    });
  });

  sheet.views = [{ state: 'frozen', ySplit: 5 }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
