export default function LoadingScreen({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-brand-gray-light border-t-brand-red"
        role="status"
        aria-label="Lädt"
      />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
