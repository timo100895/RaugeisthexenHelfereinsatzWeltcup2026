import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-bold">Seite nicht gefunden</h1>
      <p className="mt-2 text-gray-600">Diese Seite existiert nicht.</p>
      <Link to="/" className="mt-4 inline-block text-brand-red underline">
        Zur Startseite
      </Link>
    </div>
  );
}
