import ExcelJS from 'exceljs';
import { computeOccupancy } from './capacity';
import { computeEventStats, formatHoursDecimal } from './stats';
import { computeOverlap, formatTime, weekdayLabel, formatDateShort } from './time';

const STATUS_LABEL: Record<string, string> = {
  active: 'Angemeldet',
  cancelled: 'Storniert',
  waitlist: 'Warteliste',
};

function excelDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function excelTime(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  // Fester Referenztag; Excel interpretiert dies bei numFmt "hh:mm" als reine Uhrzeit.
  return new Date(Date.UTC(1899, 11, 30, h, m));
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
    cell.alignment = { vertical: 'middle' };
  });
}

/**
 * Baut die vollständige Excel-Arbeitsmappe mit allen Arbeitsblättern aus
 * Abschnitt 46-50 / 90. "shifts" ist das Ergebnis von listShiftsForEvent().
 */
export async function buildEventWorkbook(eventTitle: string, shifts: any[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Helfereinteilung Ornemer Raugeisthexen';
  workbook.created = new Date();

  const sortedShifts = [...shifts].sort(
    (a, b) => a.event_day.date.localeCompare(b.event_day.date) || a.start_time.localeCompare(b.start_time)
  );

  // ---- Arbeitsblatt: Helferplan --------------------------------------------
  const maxCapacity = Math.max(1, ...sortedShifts.map((s) => computeOccupancy(s, s.leaders, s.registrations).capacity));

  const planSheet = workbook.addWorksheet('Helferplan');
  const planHeader = [
    'Datum',
    'Wochentag',
    'Schicht',
    'Beginn',
    'Ende',
    'Übergabe',
    'Schichtchef',
    ...Array.from({ length: maxCapacity }, (_, i) => `Helfer ${i + 1}`),
  ];
  planSheet.columns = planHeader.map((h) => ({ header: h, width: h.startsWith('Helfer') ? 22 : 16 }));
  styleHeaderRow(planSheet.getRow(1));
  planSheet.views = [{ state: 'frozen', ySplit: 1 }];
  planSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: planHeader.length } };

  sortedShifts.forEach((shift, idx) => {
    const primary = shift.leaders.find((l: any) => l.is_primary);
    const activeHelpers = shift.registrations
      .filter((r: any) => r.status === 'active')
      .map((r: any) => `${r.helper.first_name} ${r.helper.last_name}`);

    const next = sortedShifts[idx + 1];
    const overlap =
      next && next.event_day.date === shift.event_day.date ? computeOverlap(shift, next) : null;
    const handover =
      overlap?.hasOverlap && overlap.start && overlap.end
        ? `${formatTime(overlap.start)}–${formatTime(overlap.end)}`
        : '';

    const row = planSheet.addRow([
      excelDate(shift.event_day.date),
      weekdayLabel(shift.event_day.date),
      shift.name,
      excelTime(shift.start_time),
      excelTime(shift.end_time),
      handover,
      primary ? `${primary.board_member.first_name} ${primary.board_member.last_name}` : '',
      ...activeHelpers,
    ]);
    row.getCell(1).numFmt = 'dd.mm.yyyy';
    row.getCell(4).numFmt = 'hh:mm';
    row.getCell(5).numFmt = 'hh:mm';
  });

  // ---- Arbeitsblatt: Alle Helfer --------------------------------------------
  const allSheet = workbook.addWorksheet('Alle Helfer');
  const allHeader = [
    'Vorname',
    'Nachname',
    'Telefon',
    'E-Mail',
    'Veranstaltung',
    'Datum',
    'Schicht',
    'Beginn',
    'Ende',
    'Schichtchef',
    'Status',
    'Bemerkung',
    'Anmeldedatum',
  ];
  allSheet.columns = allHeader.map((h) => ({ header: h, width: 18 }));
  styleHeaderRow(allSheet.getRow(1));
  allSheet.views = [{ state: 'frozen', ySplit: 1 }];
  allSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: allHeader.length } };

  for (const shift of sortedShifts) {
    const primary = shift.leaders.find((l: any) => l.is_primary);
    for (const reg of shift.registrations) {
      const row = allSheet.addRow([
        reg.helper.first_name,
        reg.helper.last_name,
        reg.helper.phone ?? '',
        reg.helper.email ?? '',
        eventTitle,
        excelDate(shift.event_day.date),
        shift.name,
        excelTime(shift.start_time),
        excelTime(shift.end_time),
        primary ? `${primary.board_member.first_name} ${primary.board_member.last_name}` : '',
        STATUS_LABEL[reg.status] ?? reg.status,
        reg.notes ?? '',
        new Date(reg.created_at),
      ]);
      row.getCell(6).numFmt = 'dd.mm.yyyy';
      row.getCell(8).numFmt = 'hh:mm';
      row.getCell(9).numFmt = 'hh:mm';
      row.getCell(13).numFmt = 'dd.mm.yyyy hh:mm';
    }
  }

  // ---- Arbeitsblatt: Schichtübersicht ---------------------------------------
  const overviewSheet = workbook.addWorksheet('Schichtübersicht');
  const overviewHeader = ['Datum', 'Schicht', 'Beginn', 'Ende', 'Kapazität', 'Belegt', 'Frei', 'Schichtchef', 'Status'];
  overviewSheet.columns = overviewHeader.map((h) => ({ header: h, width: 16 }));
  styleHeaderRow(overviewSheet.getRow(1));
  overviewSheet.views = [{ state: 'frozen', ySplit: 1 }];
  overviewSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: overviewHeader.length } };

  const STATUS_SHIFT_LABEL: Record<string, string> = { open: 'Offen', closed: 'Geschlossen', cancelled: 'Abgesagt' };

  for (const shift of sortedShifts) {
    const occ = computeOccupancy(shift, shift.leaders, shift.registrations);
    const primary = shift.leaders.find((l: any) => l.is_primary);
    const row = overviewSheet.addRow([
      excelDate(shift.event_day.date),
      shift.name,
      excelTime(shift.start_time),
      excelTime(shift.end_time),
      occ.capacity,
      occ.active,
      occ.available,
      primary ? `${primary.board_member.first_name} ${primary.board_member.last_name}` : '',
      STATUS_SHIFT_LABEL[shift.status] ?? shift.status,
    ]);
    row.getCell(1).numFmt = 'dd.mm.yyyy';
    row.getCell(3).numFmt = 'hh:mm';
    row.getCell(4).numFmt = 'hh:mm';
  }

  // ---- Arbeitsblatt: Auswertung ----------------------------------------------
  const stats = computeEventStats(sortedShifts);
  const evalSheet = workbook.addWorksheet('Auswertung');
  evalSheet.columns = [{ width: 28 }, { width: 16 }];
  evalSheet.addRow(['Kennzahl', 'Wert']);
  styleHeaderRow(evalSheet.getRow(1));
  evalSheet.addRow(['Helferplätze gesamt', stats.totalCapacity]);
  evalSheet.addRow(['Belegte Plätze', stats.totalFilled]);
  evalSheet.addRow(['Freie Plätze', stats.totalFree]);
  evalSheet.addRow(['Unterschiedliche Helfer', stats.uniqueHelperCount]);
  evalSheet.addRow(['Helfereinsätze gesamt', stats.totalAssignments]);
  evalSheet.addRow(['Vollständig besetzte Schichten', stats.fullyStaffedShifts]);
  evalSheet.addRow(['Noch offene Schichten', stats.openShifts]);
  evalSheet.addRow(['Abgesagte Schichten', stats.cancelledShifts]);
  evalSheet.addRow([]);
  evalSheet.addRow(['Belegung je Tag', '']).font = { bold: true };
  evalSheet.addRow(['Tag', 'Belegt / Kapazität']);
  for (const [date, d] of Object.entries(stats.perDay).sort(([a], [b]) => a.localeCompare(b))) {
    evalSheet.addRow([`${weekdayLabel(date)}, ${formatDateShort(date)}`, `${d.filled} / ${d.capacity}`]);
  }

  // ---- Arbeitsblatt: Helferstatistik ------------------------------------------
  const statSheet = workbook.addWorksheet('Helferstatistik');
  statSheet.columns = [
    { header: 'Vorname', width: 18 },
    { header: 'Nachname', width: 18 },
    { header: 'Anzahl Einsätze', width: 16 },
    { header: 'Gesamtstunden', width: 16 },
  ];
  styleHeaderRow(statSheet.getRow(1));
  statSheet.views = [{ state: 'frozen', ySplit: 1 }];
  statSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  for (const h of stats.helperStats) {
    statSheet.addRow([h.firstName, h.lastName, h.shiftCount, formatHoursDecimal(h.totalMinutes)]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
