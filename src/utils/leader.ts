// Ermittelt den anzuzeigenden Schichtchef: Freitext-Eintrag an der Schicht
// hat Vorrang vor dem verknüpften primären Vorstands-/Verantwortlichen-
// Eintrag (siehe Migration 0010_shift_leader_freitext.sql).

interface LeaderLike {
  is_primary: boolean;
  board_member: { first_name: string; last_name: string; phone: string | null; email?: string | null };
}

interface ShiftLike {
  leader_name: string | null;
  leader_phone: string | null;
}

export interface LeaderDisplay {
  name: string | null;
  phone: string | null;
  isFreeText: boolean;
}

export function getShiftLeaderDisplay(shift: ShiftLike, leaders: LeaderLike[]): LeaderDisplay {
  if (shift.leader_name && shift.leader_name.trim().length > 0) {
    return { name: shift.leader_name.trim(), phone: shift.leader_phone?.trim() || null, isFreeText: true };
  }
  const primary = leaders.find((l) => l.is_primary);
  if (primary) {
    return {
      name: `${primary.board_member.first_name} ${primary.board_member.last_name}`,
      phone: primary.board_member.phone,
      isFreeText: false,
    };
  }
  return { name: null, phone: null, isFreeText: false };
}
