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
import { LangProvider } from "./i18n.js";
import { HelpPage } from "./pages/HelpPage.js";
import { RestaurantPickerPage } from "./pages/RestaurantPickerPage.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) {
    return <Navigate to="/today" replace />;
  }
  return <>{children}</>;
}

function RequireRestaurantContext({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, restaurant } = useAuth();
  if (isSuperAdmin && !restaurant) {
    return <Navigate to="/restaurants" replace />;
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
        <Route
          path="/restaurants"
          element={
            <SuperAdminRoute>
              <RestaurantPickerPage />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/today"
          element={
            <RequireRestaurantContext>
              <TodayPage />
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/reservations"
          element={
            <RequireRestaurantContext>
              <ReservationsPage />
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/waitlist"
          element={
            <RequireRestaurantContext>
              <WaitlistPage />
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/guests"
          element={
            <RequireRestaurantContext>
              <GuestsPage />
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/guests/:id"
          element={
            <RequireRestaurantContext>
              <GuestDetailPage />
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireRestaurantContext>
              <SettingsPage />
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/help"
          element={
            <RequireRestaurantContext>
              <HelpPage />
            </RequireRestaurantContext>
          }
        />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </LangProvider>
    </AuthProvider>
  );
}
