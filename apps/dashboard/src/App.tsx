import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { TodayPage } from "./pages/TodayPage.js";
import { ReservationsPage } from "./pages/ReservationsPage.js";
import { GuestsPage } from "./pages/GuestsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/guests" element={<GuestsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
