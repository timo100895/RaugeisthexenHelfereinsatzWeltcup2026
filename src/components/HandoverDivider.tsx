import { formatTimeRange } from '@/utils/time';

export default function HandoverDivider({ start, end }: { start: string; end: string }) {
  return (
    <div className="my-2 flex items-center gap-3 px-1">
      <div className="h-px flex-1 border-t border-dashed border-gray-300" />
      <span className="whitespace-nowrap rounded-full bg-brand-gray-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Übergabe · {formatTimeRange(start, end)}
      </span>
      <div className="h-px flex-1 border-t border-dashed border-gray-300" />
    </div>
  );
}
