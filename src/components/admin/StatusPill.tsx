import type { ReactNode } from 'react';
import type { ShiftOccupancy } from '@/utils/capacity';

export function ShiftStatusPill({
  occupancy,
  shiftStatus,
}: {
  occupancy: ShiftOccupancy;
  shiftStatus: 'open' | 'closed' | 'cancelled';
}) {
  if (shiftStatus === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
        ⛔ Abgesagt
      </span>
    );
  }
  if (shiftStatus === 'closed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
        ■ Geschlossen
      </span>
    );
  }
  if (occupancy.isFull) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-3 py-1 text-xs font-semibold text-brand-green-dark">
        ✓ Vollständig besetzt
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red">
      ⚠ {occupancy.available} Helfer benötigt
    </span>
  );
}

export function GenericPill({ tone, children }: { tone: 'green' | 'red' | 'gray'; children: ReactNode }) {
  const styles = {
    green: 'bg-brand-green/10 text-brand-green-dark',
    red: 'bg-brand-red/10 text-brand-red',
    gray: 'bg-gray-200 text-gray-700',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}
