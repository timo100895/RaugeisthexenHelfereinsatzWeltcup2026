import { describe, it, expect } from 'vitest';
import { effectiveCapacity, computeOccupancy } from '@/utils/capacity';
import type { RegistrationRow, ShiftLeaderRow, ShiftRow } from '@/types/database';

function makeShift(overrides: Partial<ShiftRow> = {}): ShiftRow {
  return {
    id: 's1',
    event_id: 'e1',
    event_day_id: 'd1',
    name: 'Schicht 1',
    start_time: '11:00:00',
    end_time: '15:15:00',
    capacity: 4,
    status: 'open',
    manually_locked: false,
    leader_counts_as_helper: false,
    notes: null,
    display_order: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function makeLeader(overrides: Partial<ShiftLeaderRow> = {}): ShiftLeaderRow {
  return { id: 'l1', shift_id: 's1', board_member_id: 'bm1', role: 'leader', is_primary: true, ...overrides };
}

function makeReg(overrides: Partial<RegistrationRow> = {}): RegistrationRow {
  return {
    id: `r-${Math.random()}`,
    helper_id: 'h1',
    shift_id: 's1',
    status: 'active',
    source: 'public',
    notes: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('effectiveCapacity', () => {
  it('entspricht der vollen Kapazität, wenn der Schichtchef nicht mitzählt', () => {
    const shift = makeShift({ capacity: 4, leader_counts_as_helper: false });
    expect(effectiveCapacity(shift, [makeLeader()])).toBe(4);
  });

  it('reduziert die Kapazität um 1, wenn der Schichtchef mitzählt und zugeordnet ist', () => {
    const shift = makeShift({ capacity: 4, leader_counts_as_helper: true });
    expect(effectiveCapacity(shift, [makeLeader()])).toBe(3);
  });

  it('reduziert NICHT, wenn kein primärer Schichtchef zugeordnet ist', () => {
    const shift = makeShift({ capacity: 4, leader_counts_as_helper: true });
    expect(effectiveCapacity(shift, [])).toBe(4);
  });

  it('wird nie negativ (Kapazität 1, Schichtchef zählt mit)', () => {
    const shift = makeShift({ capacity: 1, leader_counts_as_helper: true });
    expect(effectiveCapacity(shift, [makeLeader()])).toBe(0);
  });
});

describe('computeOccupancy', () => {
  it('markiert eine Schicht als voll, wenn aktive Anmeldungen die Kapazität erreichen', () => {
    const shift = makeShift({ capacity: 2 });
    const regs = [makeReg(), makeReg()];
    const occ = computeOccupancy(shift, [], regs);
    expect(occ.isFull).toBe(true);
    expect(occ.available).toBe(0);
  });

  it('zählt stornierte und Warteliste-Anmeldungen nicht als aktive Belegung', () => {
    const shift = makeShift({ capacity: 4 });
    const regs = [makeReg({ status: 'active' }), makeReg({ status: 'cancelled' }), makeReg({ status: 'waitlist' })];
    const occ = computeOccupancy(shift, [], regs);
    expect(occ.active).toBe(1);
    expect(occ.waitlist).toBe(1);
    expect(occ.available).toBe(3);
    expect(occ.isFull).toBe(false);
  });
});
