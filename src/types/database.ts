export type EventStatus = 'draft' | 'active' | 'closed' | 'archived';
export type ShiftStatus = 'open' | 'closed' | 'cancelled';
export type RegistrationStatus = 'active' | 'cancelled' | 'waitlist';
export type AdminRole = 'admin' | 'viewer' | 'shift_leader';
export type LeaderRole = 'leader' | 'support';

export interface AppSettings {
  id: 1;
  org_name: string;
  logo_url: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  default_capacity: number;
  notify_emails: string[];
  privacy_notice: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  status: EventStatus;
  public_registration_enabled: boolean;
  waitlist_enabled: boolean;
  show_leader_public: boolean;
  notify_leader_on_registration: boolean;
  notify_emails: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventDayRow {
  id: string;
  event_id: string;
  date: string;
  display_order: number;
}

export interface BoardMemberRow {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftRow {
  id: string;
  event_id: string;
  event_day_id: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: ShiftStatus;
  manually_locked: boolean;
  leader_counts_as_helper: boolean;
  leader_name: string | null;
  leader_phone: string | null;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShiftLeaderRow {
  id: string;
  shift_id: string;
  board_member_id: string;
  role: LeaderRole;
  is_primary: boolean;
}

export interface HelperRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRow {
  id: string;
  helper_id: string;
  shift_id: string;
  status: RegistrationStatus;
  source: 'public' | 'admin';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfileRow {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  role: AdminRole;
  board_member_id: string | null;
  active: boolean;
}

export interface PublicShiftStatus {
  shift_id: string;
  event_id: string;
  event_day_id: string;
  date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  display_order: number;
  status: ShiftStatus;
  capacity: number;
  effective_capacity: number;
  active_count: number;
  available_count: number;
  is_full: boolean;
  manually_locked: boolean;
  waitlist_enabled: boolean;
  leader_public_name: string | null;
  helper_first_names: string[] | null;
}

export interface RegistrationDetail {
  registration_id: string;
  status: RegistrationStatus;
  created_at: string;
  shift_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  date: string;
  event_id: string;
  event_title: string;
}

export interface HelperWithRegistrations {
  helper_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  registrations: RegistrationDetail[];
}

// Zusammengesetzte Admin-Sichten
export interface ShiftWithDetails extends ShiftRow {
  event_day: EventDayRow;
  leaders: (ShiftLeaderRow & { board_member: BoardMemberRow })[];
  registrations: (RegistrationRow & { helper: HelperRow })[];
}
