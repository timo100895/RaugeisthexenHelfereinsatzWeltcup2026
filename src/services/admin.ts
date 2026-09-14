import { supabase } from './supabase';
import type {
  EventRow,
  EventDayRow,
  BoardMemberRow,
  ShiftRow,
  AppSettings,
} from '@/types/database';

function unwrap<T>({ data, error }: { data: T | null; error: any }): T {
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export async function listEvents(): Promise<EventRow[]> {
  return unwrap(
    await supabase.from('events').select('*').order('start_date', { ascending: false })
  );
}

export async function getEvent(id: string): Promise<EventRow> {
  return unwrap(await supabase.from('events').select('*').eq('id', id).single());
}

export interface EventInput {
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  status: EventRow['status'];
  public_registration_enabled: boolean;
  waitlist_enabled: boolean;
  show_leader_public: boolean;
  notify_leader_on_registration: boolean;
  notify_emails: string[];
  notes: string | null;
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  return unwrap(await supabase.from('events').insert(input).select().single());
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<EventRow> {
  return unwrap(await supabase.from('events').update(input).eq('id', id).select().single());
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateEvent(id: string, newTitle: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_duplicate_event', {
    p_event_id: id,
    p_new_title: newTitle,
  });
  if (error) throw error;
  return data as string;
}

// ---------------------------------------------------------------------------
// Event days
// ---------------------------------------------------------------------------
export async function listEventDays(eventId: string): Promise<EventDayRow[]> {
  return unwrap(
    await supabase
      .from('event_days')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })
  );
}

export async function createEventDay(eventId: string, date: string, displayOrder: number) {
  return unwrap(
    await supabase
      .from('event_days')
      .insert({ event_id: eventId, date, display_order: displayOrder })
      .select()
      .single()
  );
}

export async function deleteEventDay(id: string): Promise<void> {
  const { error } = await supabase.from('event_days').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------
export interface ShiftInput {
  event_id: string;
  event_day_id: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: ShiftRow['status'];
  manually_locked: boolean;
  leader_counts_as_helper: boolean;
  notes: string | null;
  display_order: number;
}

export async function listShiftsForEvent(eventId: string) {
  return unwrap(
    await supabase
      .from('shifts')
      .select(
        `*, event_day:event_days(*), leaders:shift_leaders(*, board_member:board_members(*)), registrations(*, helper:helpers(*))`
      )
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })
  );
}

export async function getShift(id: string) {
  return unwrap(
    await supabase
      .from('shifts')
      .select(
        `*, event_day:event_days(*), leaders:shift_leaders(*, board_member:board_members(*)), registrations(*, helper:helpers(*))`
      )
      .eq('id', id)
      .single()
  );
}

export async function createShift(input: ShiftInput): Promise<ShiftRow> {
  return unwrap(await supabase.from('shifts').insert(input).select().single());
}

export async function updateShift(id: string, input: Partial<ShiftInput>): Promise<ShiftRow> {
  return unwrap(await supabase.from('shifts').update(input).eq('id', id).select().single());
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateShift(shift: ShiftRow): Promise<ShiftRow> {
  const { id, created_at, updated_at, ...rest } = shift as any;
  return createShift({ ...rest, name: `${shift.name} (Kopie)` });
}

export interface LeaderAssignment {
  board_member_id: string;
  role: 'leader' | 'support';
  is_primary: boolean;
}

export async function setShiftLeaders(shiftId: string, leaders: LeaderAssignment[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_shift_leaders', {
    p_shift_id: shiftId,
    p_leaders: leaders,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Board members
// ---------------------------------------------------------------------------
export async function listBoardMembers(includeInactive = true): Promise<BoardMemberRow[]> {
  let query = supabase.from('board_members').select('*').order('last_name', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  return unwrap(await query);
}

export interface BoardMemberInput {
  first_name: string;
  last_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
}

export async function createBoardMember(input: BoardMemberInput): Promise<BoardMemberRow> {
  return unwrap(await supabase.from('board_members').insert(input).select().single());
}

export async function updateBoardMember(
  id: string,
  input: Partial<BoardMemberInput>
): Promise<BoardMemberRow> {
  return unwrap(await supabase.from('board_members').update(input).eq('id', id).select().single());
}

export async function deleteBoardMember(id: string): Promise<void> {
  const { error } = await supabase.from('board_members').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Registrations / Helpers
// ---------------------------------------------------------------------------
export async function addHelperToShift(payload: {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  shift_id: string;
}) {
  const { data, error } = await supabase.rpc('admin_add_helper_to_shift', {
    p_first_name: payload.first_name,
    p_last_name: payload.last_name,
    p_email: payload.email,
    p_phone: payload.phone,
    p_notes: payload.notes,
    p_shift_id: payload.shift_id,
  });
  if (error) throw error;
  return data;
}

export async function moveRegistration(registrationId: string, newShiftId: string) {
  const { data, error } = await supabase.rpc('admin_move_registration', {
    p_registration_id: registrationId,
    p_new_shift_id: newShiftId,
  });
  if (error) throw error;
  return data;
}

export async function cancelRegistration(registrationId: string) {
  const { error } = await supabase.rpc('admin_cancel_registration', {
    p_registration_id: registrationId,
  });
  if (error) throw error;
}

export async function promoteFromWaitlist(registrationId: string) {
  const { error } = await supabase.rpc('admin_promote_from_waitlist', {
    p_registration_id: registrationId,
  });
  if (error) throw error;
}

export async function updateHelperRecord(
  id: string,
  input: Partial<{ first_name: string; last_name: string; email: string | null; phone: string | null; notes: string | null }>
) {
  const { error } = await supabase.from('helpers').update(input).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------
export async function getAppSettings(): Promise<AppSettings> {
  return unwrap(await supabase.from('app_settings').select('*').eq('id', 1).single());
}

export async function updateAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  return unwrap(await supabase.from('app_settings').update(input).eq('id', 1).select().single());
}
