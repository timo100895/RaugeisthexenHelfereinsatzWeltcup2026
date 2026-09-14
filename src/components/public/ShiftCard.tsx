import type { PublicShiftStatus } from '@/types/database';
import { formatTimeRange } from '@/utils/time';
import CapacityBadge from '@/components/CapacityBadge';

interface Props {
  shift: PublicShiftStatus;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export default function ShiftCard({ shift, selected, disabled, onToggle }: Props) {
  const isClosed = shift.status !== 'open' || shift.manually_locked;
  const cannotSelect = disabled || isClosed || (shift.is_full && !shift.waitlist_enabled);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={cannotSelect && !selected}
      aria-pressed={selected}
      className={`focus-ring w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99] ${
        selected
          ? 'border-brand-red bg-red-50 shadow-md'
          : cannotSelect
            ? 'border-gray-200 bg-gray-50 opacity-70'
            : 'border-gray-200 bg-white hover:border-brand-red/50 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-brand-black">{shift.shift_name}</p>
          <p className="text-base text-gray-700">{formatTimeRange(shift.start_time, shift.end_time)}</p>
          {shift.leader_public_name && (
            <p className="mt-1 text-sm text-gray-500">Schichtchef: {shift.leader_public_name}</p>
          )}
        </div>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-brand-red bg-brand-red text-white' : 'border-gray-300 bg-white'
          }`}
          aria-hidden
        >
          {selected && '✓'}
        </div>
      </div>
      <div className="mt-3">
        <CapacityBadge
          available={shift.available_count}
          capacity={shift.effective_capacity}
          isFull={shift.is_full}
          isClosed={isClosed}
        />
        {shift.is_full && shift.waitlist_enabled && !isClosed && (
          <span className="ml-2 text-sm text-gray-500">Anmeldung auf Warteliste möglich</span>
        )}
        {shift.helper_first_names && shift.helper_first_names.length > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Bereits dabei: {shift.helper_first_names.join(', ')}
          </p>
        )}
      </div>
    </button>
  );
}
