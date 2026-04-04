import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { ToastProvider } from "./components/Toast.js";
import { TodayPage } from "./pages/TodayPage.js";
import { ReservationsPage } from "./pages/ReservationsPage.js";
import { GuestsPage } from "./pages/GuestsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { WaitlistPage } from "./pages/WaitlistPage.js";
import { GuestDetailPage } from "./pages/GuestDetailPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { AuthProvider, useAuth } from "./hooks/useAuth.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/guests" element={<GuestsPage />} />
        <Route path="/guests/:id" element={<GuestDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
