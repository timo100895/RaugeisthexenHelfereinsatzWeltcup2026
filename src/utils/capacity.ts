import type { RegistrationRow, ShiftLeaderRow, ShiftRow } from '@/types/database';

/**
 * Spiegelt die Logik von shift_effective_capacity() aus 0002_functions_triggers.sql
 * für die Client-seitige Anzeige, wenn Schichten bereits inkl. Leiter/Registrierungen
 * geladen wurden (spart zusätzliche Round-Trips in Admin-Ansichten).
 */
export function effectiveCapacity(shift: ShiftRow, leaders: ShiftLeaderRow[]): number {
  const hasPrimary = leaders.some((l) => l.is_primary);
  const reduction = shift.leader_counts_as_helper && hasPrimary ? 1 : 0;
  return Math.max(0, shift.capacity - reduction);
}

export function activeCount(registrations: RegistrationRow[]): number {
  return registrations.filter((r) => r.status === 'active').length;
}

export function waitlistCount(registrations: RegistrationRow[]): number {
  return registrations.filter((r) => r.status === 'waitlist').length;
}

export interface ShiftOccupancy {
  capacity: number;
  active: number;
  waitlist: number;
  available: number;
  isFull: boolean;
}

export function computeOccupancy(
  shift: ShiftRow,
  leaders: ShiftLeaderRow[],
  registrations: RegistrationRow[]
): ShiftOccupancy {
  const capacity = effectiveCapacity(shift, leaders);
  const active = activeCount(registrations);
  const waitlist = waitlistCount(registrations);
  return {
    capacity,
    active,
    waitlist,
    available: Math.max(0, capacity - active),
    isFull: active >= capacity,
  };
}
