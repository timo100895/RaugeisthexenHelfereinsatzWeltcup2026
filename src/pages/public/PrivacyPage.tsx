import { Link } from 'react-router-dom';
import { useSettings } from '@/context/SettingsContext';

export default function PrivacyPage() {
  const { settings } = useSettings();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Datenschutz</h1>
      <p className="mt-4 text-gray-700">{settings.privacy_notice}</p>

      <div className="mt-6 space-y-4 text-sm text-gray-600">
        <p>
          <strong>Hinweis:</strong> Dies ist ein technischer Platzhaltertext. Er ersetzt keine
          rechtsverbindliche Datenschutzerklärung. Der Verein sollte diesen Text vor dem
          Produktivbetrieb durch eine rechtsgeprüfte Datenschutzerklärung ersetzen (z.B. mit Angaben
          zu Verantwortlichem, Speicherdauer, Rechten der Betroffenen gem. Art. 13/14 DSGVO).
        </p>
        <p>
          Bei der Helferanmeldung erhobene Daten (Name, E-Mail-Adresse und/oder Telefonnummer,
          optionale Bemerkung) werden ausschließlich zur Organisation und Kommunikation rund um die
          Helfereinsätze der {settings.org_name} verwendet und nicht an Dritte weitergegeben.
        </p>
      </div>

      <Link to="/" className="mt-8 inline-block text-brand-red underline">
        Zurück zur Startseite
      </Link>
    </div>
  );
}
