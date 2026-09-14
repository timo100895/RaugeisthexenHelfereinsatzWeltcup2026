import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getEvent,
  listEventDays,
  listBoardMembers,
  listShiftsForEvent,
  createShift,
  updateShift,
  deleteShift,
  duplicateShift,
  setShiftLeaders,
  cancelRegistration,
  promoteFromWaitlist,
  type ShiftInput,
  type LeaderAssignment,
} from '@/services/admin';
import type { EventRow, EventDayRow, BoardMemberRow, ShiftRow } from '@/types/database';
import { computeOccupancy } from '@/utils/capacity';
import { getShiftLeaderDisplay } from '@/utils/leader';
import { computeOverlap, formatDateLong, formatTimeRange } from '@/utils/time';
import { friendlyErrorMessage } from '@/utils/errors';
import LoadingScreen from '@/components/LoadingScreen';
import HandoverDivider from '@/components/HandoverDivider';
import { ShiftStatusPill } from '@/components/admin/StatusPill';
import ShiftFormModal from '@/components/admin/ShiftFormModal';
import AddHelperModal from '@/components/admin/AddHelperModal';
import MoveHelperModal from '@/components/admin/MoveHelperModal';

export default function AdminShifts() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [days, setDays] = useState<EventDayRow[]>([]);
  const [boardMembers, setBoardMembers] = useState<BoardMemberRow[]>([]);
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [shiftModal, setShiftModal] = useState<'new' | any | null>(null);
  const [shiftModalDay, setShiftModalDay] = useState<string | undefined>(undefined);
  const [addHelperShift, setAddHelperShift] = useState<any | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ registration: any; shift: any } | null>(null);

  async function reload() {
    if (!eventId) return;
    const [ev, d, bm, s] = await Promise.all([
      getEvent(eventId),
      listEventDays(eventId),
      listBoardMembers(false),
      listShiftsForEvent(eventId),
    ]);
    setEvent(ev);
    setDays(d);
    setBoardMembers(bm);
    setShifts(s);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!event || shifts === null) return <LoadingScreen />;

  const shiftsByDay = days.map((day) => ({
    day,
    shifts: shifts
      .filter((s) => s.event_day_id === day.id)
      .sort((a, b) => a.display_order - b.display_order || a.start_time.localeCompare(b.start_time)),
  }));

  const allShiftOptions = shifts.map((s) => ({
    id: s.id,
    name: s.name,
    date: s.event_day.date,
    start_time: s.start_time,
    end_time: s.end_time,
  }));

  async function handleSaveShift(input: ShiftInput, leaders: LeaderAssignment[]) {
    let shiftId: string;
    if (shiftModal === 'new') {
      const created = await createShift(input);
      shiftId = created.id;
    } else {
      const updated = await updateShift(shiftModal.id, input);
      shiftId = updated.id;
    }
    await setShiftLeaders(shiftId, leaders);
    setShiftModal(null);
    await reload();
  }

  async function handleDeleteShift(shift: ShiftRow) {
    if (!window.confirm(`Schicht "${shift.name}" wirklich löschen? Alle Anmeldungen gehen verloren.`)) return;
    try {
      await deleteShift(shift.id);
      await reload();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function handleDuplicateShift(shift: ShiftRow) {
    await duplicateShift(shift);
    await reload();
  }

  async function handleToggleStatus(shift: ShiftRow) {
    await updateShift(shift.id, { status: shift.status === 'open' ? 'closed' : 'open' });
    await reload();
  }

  async function handleCancelRegistration(registrationId: string) {
    if (!window.confirm('Diese Anmeldung wirklich absagen?')) return;
    try {
      await cancelRegistration(registrationId);
      await reload();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  async function handlePromote(registrationId: string) {
    try {
      await promoteFromWaitlist(registrationId);
      await reload();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/admin/veranstaltungen/${event.id}`} className="text-sm text-gray-500 underline">
            ← {event.title}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Schichten verwalten</h1>
        </div>
        <button
          onClick={() => {
            setShiftModalDay(days[0]?.id);
            setShiftModal('new');
          }}
          disabled={days.length === 0}
          className="rounded-xl bg-brand-red px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          + Neue Schicht
        </button>
      </div>

      {days.length === 0 && (
        <p className="text-gray-500">
          Bitte lege zuerst mindestens einen{' '}
          <Link to={`/admin/veranstaltungen/${event.id}`} className="underline">
            Veranstaltungstag
          </Link>{' '}
          an.
        </p>
      )}

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-brand-red">{error}</p>}

      {shiftsByDay.map(({ day, shifts: dayShifts }) => (
        <section key={day.id} className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{formatDateLong(day.date)}</h2>
            <button
              onClick={() => {
                setShiftModalDay(day.id);
                setShiftModal('new');
              }}
              className="text-sm font-semibold text-brand-red"
            >
              + Schicht an diesem Tag
            </button>
          </div>

          {dayShifts.length === 0 ? (
            <p className="text-gray-500">Keine Schichten an diesem Tag.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {dayShifts.map((shift, idx) => {
                const occ = computeOccupancy(shift, shift.leaders, shift.registrations);
                const next = dayShifts[idx + 1];
                const overlap = next ? computeOverlap(shift, next) : null;
                const activeRegs = shift.registrations.filter((r: any) => r.status === 'active');
                const waitlistRegs = shift.registrations.filter((r: any) => r.status === 'waitlist');
                const leader = getShiftLeaderDisplay(shift, shift.leaders);
                const others = shift.leaders.filter((l: any) => !l.is_primary);

                return (
                  <div key={shift.id}>
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold">{shift.name}</p>
                          <p className="text-gray-600">{formatTimeRange(shift.start_time, shift.end_time)}</p>
                        </div>
                        <ShiftStatusPill occupancy={occ} shiftStatus={shift.status} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                        {leader.name && (
                          <p>
                            Schichtchef: <strong>{leader.name}</strong>
                            {leader.phone && ` · ${leader.phone}`}
                          </p>
                        )}
                        {others.map((l: any) => (
                          <p key={l.id}>
                            Weitere/r Verantwortliche/r: {l.board_member.first_name} {l.board_member.last_name}
                          </p>
                        ))}
                        {shift.leader_counts_as_helper && <p className="italic">Schichtchef zählt als Helfer</p>}
                        {shift.manually_locked && <p className="font-semibold text-brand-red">Manuell gesperrt</p>}
                      </div>

                      <ul className="mt-3 flex flex-col gap-2">
                        {activeRegs.map((r: any) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-gray-light px-3 py-2 text-sm"
                          >
                            <span>
                              {r.helper.first_name} {r.helper.last_name}
                              {r.helper.phone && ` · ${r.helper.phone}`}
                              {r.helper.email && ` · ${r.helper.email}`}
                            </span>
                            <span className="flex gap-2">
                              <button
                                onClick={() => setMoveTarget({ registration: r, shift })}
                                className="font-semibold text-gray-600 underline"
                              >
                                Verschieben
                              </button>
                              <button
                                onClick={() => handleCancelRegistration(r.id)}
                                className="font-semibold text-brand-red underline"
                              >
                                Absagen
                              </button>
                            </span>
                          </li>
                        ))}
                        {waitlistRegs.map((r: any) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm"
                          >
                            <span>
                              {r.helper.first_name} {r.helper.last_name} · Warteliste
                            </span>
                            <span className="flex gap-2">
                              <button
                                onClick={() => handlePromote(r.id)}
                                className="font-semibold text-brand-green-dark underline"
                              >
                                Nachrücken lassen
                              </button>
                              <button
                                onClick={() => handleCancelRegistration(r.id)}
                                className="font-semibold text-brand-red underline"
                              >
                                Entfernen
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => setAddHelperShift(shift)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                        >
                          + Helfer hinzufügen
                        </button>
                        <button
                          onClick={() => setShiftModal(shift)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleToggleStatus(shift)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                        >
                          {shift.status === 'open' ? 'Schließen' : 'Öffnen'}
                        </button>
                        <button
                          onClick={() => handleDuplicateShift(shift)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                        >
                          Duplizieren
                        </button>
                        <button
                          onClick={() => handleDeleteShift(shift)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-brand-red"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>

                    {overlap?.hasOverlap && overlap.start && overlap.end && (
                      <HandoverDivider start={overlap.start} end={overlap.end} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {shiftModal && (
        <ShiftFormModal
          eventId={event.id}
          days={days}
          boardMembers={boardMembers}
          initial={shiftModal === 'new' ? undefined : shiftModal}
          defaultDayId={shiftModalDay}
          onClose={() => setShiftModal(null)}
          onSave={handleSaveShift}
        />
      )}

      {addHelperShift && (
        <AddHelperModal
          shiftId={addHelperShift.id}
          shiftLabel={`${formatDateLong(addHelperShift.event_day.date)} · ${addHelperShift.name}`}
          onClose={() => setAddHelperShift(null)}
          onSaved={() => {
            setAddHelperShift(null);
            reload();
          }}
        />
      )}

      {moveTarget && (
        <MoveHelperModal
          registrationId={moveTarget.registration.id}
          helperName={`${moveTarget.registration.helper.first_name} ${moveTarget.registration.helper.last_name}`}
          currentShiftId={moveTarget.shift.id}
          options={allShiftOptions}
          onClose={() => setMoveTarget(null)}
          onSaved={() => {
            setMoveTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
