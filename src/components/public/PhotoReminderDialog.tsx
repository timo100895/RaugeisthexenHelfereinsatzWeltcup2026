interface Props {
  /** 1 = Erinnerung beim "Weiter", 2 = Erinnerung beim "Verbindlich anmelden". */
  step: 1 | 2;
  onAddPhoto: () => void;
  onContinueWithoutPhoto: () => void;
}

/**
 * Freundliche Erinnerung an das Foto (Modus "Empfohlen"). Der Helfer kann
 * jederzeit ohne Foto fortfahren und es später über seinen persönlichen Link
 * nachreichen.
 */
export default function PhotoReminderDialog({ step, onAddPhoto, onContinueWithoutPhoto }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex w-full flex-col gap-4 rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
        <h3 className="text-lg font-bold">
          {step === 1 ? 'Foto vergessen?' : 'Noch einmal zur Erinnerung'}
        </h3>
        <p className="text-sm text-gray-700">
          Für die Akkreditierung wird ein aktuelles Foto von dir benötigt.{' '}
          {step === 1
            ? 'Du kannst jetzt eines hinzufügen – oder ohne Foto weitermachen und es später nachreichen.'
            : 'Du kannst es jetzt noch hinzufügen oder die Anmeldung ohne Foto abschließen und das Foto danach über deinen persönlichen Link nachreichen.'}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onAddPhoto}
            className="focus-ring rounded-xl bg-brand-red py-3 font-bold text-white"
          >
            Foto hinzufügen
          </button>
          <button
            type="button"
            onClick={onContinueWithoutPhoto}
            className="focus-ring rounded-xl border border-gray-300 py-3 font-semibold text-gray-700"
          >
            {step === 1 ? 'Ohne Foto weiter' : 'Ohne Foto anmelden'}
          </button>
        </div>
      </div>
    </div>
  );
}
