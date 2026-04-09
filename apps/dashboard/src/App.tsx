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
import { useCurrentRestaurant } from "./hooks/useCurrentRestaurant.js";
import type { DashboardPageKey } from "@openseat/domain";
import { isFeatureEnabled, isPageVisible } from "@openseat/domain";
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

function PageAccessRoute({
  page,
  children,
}: {
  page: DashboardPageKey;
  children: React.ReactNode;
}) {
  const { canAccess, dashboardAccess, isSuperAdmin, role } = useAuth();
  const { restaurant } = useCurrentRestaurant();
  const config = restaurant?.dashboardConfig;

  const isVisible = role
    ? isPageVisible(page, dashboardAccess, config, role)
    : canAccess(page);
  const featureAllowed = page === "waitlist" ? isFeatureEnabled("waitlist", config) : true;

  if (!canAccess(page) || !isVisible || !featureAllowed) {
    const fallbackPage = dashboardAccess.pages.find((candidate) => {
      if (!role) return true;
      if (!isPageVisible(candidate, dashboardAccess, config, role)) return false;
      if (candidate === "waitlist" && !isFeatureEnabled("waitlist", config)) return false;
      return true;
    }) ?? (isSuperAdmin ? "restaurants" : null);
    return <Navigate to={fallbackPage ? `/${fallbackPage}` : "/login"} replace />;
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
              <PageAccessRoute page="today">
                <TodayPage />
              </PageAccessRoute>
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/reservations"
          element={
            <RequireRestaurantContext>
              <PageAccessRoute page="reservations">
                <ReservationsPage />
              </PageAccessRoute>
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/waitlist"
          element={
            <RequireRestaurantContext>
              <PageAccessRoute page="waitlist">
                <WaitlistPage />
              </PageAccessRoute>
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/guests"
          element={
            <RequireRestaurantContext>
              <PageAccessRoute page="guests">
                <GuestsPage />
              </PageAccessRoute>
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/guests/:id"
          element={
            <RequireRestaurantContext>
              <PageAccessRoute page="guests">
                <GuestDetailPage />
              </PageAccessRoute>
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireRestaurantContext>
              <PageAccessRoute page="settings">
                <SettingsPage />
              </PageAccessRoute>
            </RequireRestaurantContext>
          }
        />
        <Route
          path="/help"
          element={
            <RequireRestaurantContext>
              <PageAccessRoute page="help">
                <HelpPage />
              </PageAccessRoute>
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
