import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading, isViewer } = useAuth();

  if (loading) return <LoadingScreen label="Anmeldung wird geprüft …" />;

  if (!session) return <Navigate to="/admin/login" replace />;

  if (!profile || !isViewer) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="mb-2 text-xl font-bold">Kein Zugriff</h1>
        <p className="text-gray-600">
          Dein Konto ist noch nicht für den Adminbereich freigeschaltet. Bitte wende dich an den
          Vorstand.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
