interface Props {
  available: number;
  capacity: number;
  isFull: boolean;
  isClosed?: boolean;
}

/**
 * Zeigt den Belegungsstatus IMMER über Text + Icon an, nie nur über Farbe
 * (Aufgabenstellung Abschnitt 2 / 17 / 35).
 */
export default function CapacityBadge({ available, capacity, isFull, isClosed }: Props) {
  if (isClosed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
        <span aria-hidden>■</span> Geschlossen
      </span>
    );
  }

  if (isFull) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-1 text-sm font-medium text-white">
        <span aria-hidden>✕</span> Voll belegt
      </span>
    );
  }

  if (available === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-3 py-1 text-sm font-semibold text-brand-red">
        <span aria-hidden>⚠</span> Nur noch 1 Platz frei
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-3 py-1 text-sm font-semibold text-brand-green-dark">
      <span aria-hidden>✓</span> {available} von {capacity} Plätzen frei
    </span>
  );
}

export function CapacityDots({ capacity, filled }: { capacity: number; filled: number }) {
  const dots = Array.from({ length: capacity }, (_, i) => i < filled);
  return (
    <div className="flex flex-wrap gap-1" aria-hidden>
      {dots.map((isFilled, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full border ${
            isFilled ? 'border-brand-red bg-brand-red' : 'border-gray-300 bg-white'
          }`}
        />
      ))}
    </div>
  );
}
