import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SettingsProvider } from '@/context/SettingsContext';
import { AuthProvider } from '@/context/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';
import ProtectedRoute from '@/components/ProtectedRoute';

const HomePage = lazy(() => import('@/pages/public/HomePage'));
const EventPage = lazy(() => import('@/pages/public/EventPage'));
const MyRegistrationPage = lazy(() => import('@/pages/public/MyRegistrationPage'));
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'));

const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminToday = lazy(() => import('@/pages/admin/AdminToday'));
const AdminEvents = lazy(() => import('@/pages/admin/AdminEvents'));
const AdminEventDetail = lazy(() => import('@/pages/admin/AdminEventDetail'));
const AdminShifts = lazy(() => import('@/pages/admin/AdminShifts'));
const AdminBoard = lazy(() => import('@/pages/admin/AdminBoard'));
const AdminHelpers = lazy(() => import('@/pages/admin/AdminHelpers'));
const AdminStats = lazy(() => import('@/pages/admin/AdminStats'));
const AdminExport = lazy(() => import('@/pages/admin/AdminExport'));
const AdminPrint = lazy(() => import('@/pages/admin/AdminPrint'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/veranstaltung/:slug" element={<EventPage />} />
              <Route path="/meine-anmeldung/:token" element={<MyRegistrationPage />} />
              <Route path="/datenschutz" element={<PrivacyPage />} />

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="heute" element={<AdminToday />} />
                <Route path="veranstaltungen" element={<AdminEvents />} />
                <Route path="veranstaltungen/:eventId" element={<AdminEventDetail />} />
                <Route path="veranstaltungen/:eventId/schichten" element={<AdminShifts />} />
                <Route path="vorstand" element={<AdminBoard />} />
                <Route path="helfer" element={<AdminHelpers />} />
                <Route path="auswertungen" element={<AdminStats />} />
                <Route path="export" element={<AdminExport />} />
                <Route path="druck" element={<AdminPrint />} />
                <Route path="einstellungen" element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  );
}
