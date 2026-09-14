import { computeOccupancy } from './capacity';
import { durationMinutes, formatHoursDecimal } from './time';

export interface HelperStatEntry {
  helperId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  shiftCount: number;
  totalMinutes: number;
}

export interface LeaderStatEntry {
  boardMemberId: string;
  name: string;
  shiftCount: number;
}

export interface EventStats {
  totalCapacity: number;
  totalFilled: number;
  totalFree: number;
  uniqueHelperCount: number;
  totalAssignments: number;
  fullyStaffedShifts: number;
  openShifts: number;
  cancelledShifts: number;
  perDay: Record<string, { capacity: number; filled: number }>;
  helperStats: HelperStatEntry[];
  leaderStats: LeaderStatEntry[];
}

/** shifts = Ergebnis von listShiftsForEvent() (inkl. event_day, leaders, registrations.helper) */
export function computeEventStats(shifts: any[]): EventStats {
  let totalCapacity = 0;
  let totalFilled = 0;
  let fullyStaffedShifts = 0;
  let openShifts = 0;
  let cancelledShifts = 0;
  const perDay: Record<string, { capacity: number; filled: number }> = {};
  const helperMap = new Map<string, HelperStatEntry>();
  const leaderMap = new Map<string, LeaderStatEntry>();
  const uniqueHelperIds = new Set<string>();
  let totalAssignments = 0;

  for (const shift of shifts) {
    const occ = computeOccupancy(shift, shift.leaders, shift.registrations);
    totalCapacity += occ.capacity;
    totalFilled += occ.active;

    const date = shift.event_day.date;
    if (!perDay[date]) perDay[date] = { capacity: 0, filled: 0 };
    perDay[date].capacity += occ.capacity;
    perDay[date].filled += occ.active;

    if (shift.status === 'cancelled') cancelledShifts += 1;
    else if (shift.status === 'open') {
      if (occ.isFull) fullyStaffedShifts += 1;
      else openShifts += 1;
    }

    const minutes = durationMinutes(shift.start_time, shift.end_time);

    for (const reg of shift.registrations) {
      if (reg.status !== 'active') continue;
      totalAssignments += 1;
      uniqueHelperIds.add(reg.helper_id);
      const existing = helperMap.get(reg.helper_id);
      if (existing) {
        existing.shiftCount += 1;
        existing.totalMinutes += minutes;
      } else {
        helperMap.set(reg.helper_id, {
          helperId: reg.helper_id,
          firstName: reg.helper.first_name,
          lastName: reg.helper.last_name,
          email: reg.helper.email,
          phone: reg.helper.phone,
          shiftCount: 1,
          totalMinutes: minutes,
        });
      }
    }

    for (const leader of shift.leaders) {
      const existing = leaderMap.get(leader.board_member_id);
      const name = `${leader.board_member.first_name} ${leader.board_member.last_name}`;
      if (existing) existing.shiftCount += 1;
      else leaderMap.set(leader.board_member_id, { boardMemberId: leader.board_member_id, name, shiftCount: 1 });
    }
  }

  const helperStats = [...helperMap.values()].sort((a, b) => b.shiftCount - a.shiftCount);
  const leaderStats = [...leaderMap.values()].sort((a, b) => b.shiftCount - a.shiftCount);

  return {
    totalCapacity,
    totalFilled,
    totalFree: Math.max(0, totalCapacity - totalFilled),
    uniqueHelperCount: uniqueHelperIds.size,
    totalAssignments,
    fullyStaffedShifts,
    openShifts,
    cancelledShifts,
    perDay,
    helperStats,
    leaderStats,
  };
}

export { formatHoursDecimal };
