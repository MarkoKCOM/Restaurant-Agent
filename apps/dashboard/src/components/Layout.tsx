import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useDashboard, useReservations, useGuests, useWaitlist } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useLang } from "../i18n.js";
import { useAuth } from "../hooks/useAuth.js";
import type { DashboardConfig } from "@openseat/domain";
import { ChatWidget } from "./ChatWidget.js";
import { Tooltip } from "./Tooltip.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="mr-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const DEFAULT_PAGES = ["today", "reservations", "waitlist", "guests", "settings", "help"];

export function Layout() {
  const { restaurant } = useCurrentRestaurant();
  const { lang, setLang, t } = useLang();
  const { logout, isSuperAdmin, canAccess } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: dashboard } = useDashboard(restaurant?.id);
  const { data: reservations } = useReservations({
    restaurantId: restaurant?.id,
    date: todayStr(),
  });
  const { data: guests } = useGuests(canAccess("guests") ? restaurant?.id : undefined);
  const { data: waitlistEntries } = useWaitlist(restaurant?.id, todayStr());

  const config: DashboardConfig = (restaurant as any)?.dashboardConfig ?? {};
  const visiblePages = config.visiblePages ?? DEFAULT_PAGES;
  const accentColor = config.accentColor;
  const logo = config.logo;

  const pendingCount = reservations?.filter((r) => r.status === "pending").length ?? 0;
  const todayCount = dashboard?.today?.reservations ?? 0;
  const guestCount = guests?.length ?? 0;
  const waitingCount = waitlistEntries?.filter((w) => w.status === "waiting" || w.status === "offered").length ?? 0;

  const dir = lang === "he" ? "rtl" : "ltr";
  const sidebarSide = lang === "he" ? "right-0 border-l" : "left-0 border-r";
  const mainMargin = lang === "he" ? "md:mr-64" : "md:ml-64";
  const textAlign = lang === "he" ? "text-right" : "text-left";

  const allNavItems = [
    ...(isSuperAdmin
      ? [{ to: "/restaurants", key: "restaurants", label: t.nav.restaurantsAdmin, icon: "🏢", count: 0 }]
      : []),
    { to: "/today", key: "today", label: t.nav.today, icon: "📅", count: todayCount },
    { to: "/reservations", key: "reservations", label: t.nav.reservations, icon: "📋", count: pendingCount },
    { to: "/waitlist", key: "waitlist", label: t.nav.waitlist, icon: "⏳", count: waitingCount },
    { to: "/guests", key: "guests", label: t.nav.guests, icon: "👤", count: guestCount },
    { to: "/settings", key: "settings", label: t.nav.settings, icon: "⚙️", count: 0 },
    { to: "/help", key: "help", label: t.nav.help, icon: "❓", count: 0 },
  ];

  const navItems = allNavItems.filter((item) => {
    const allowedByRole = item.key === "restaurants"
      ? isSuperAdmin && canAccess("restaurants")
      : canAccess(item.key as "today" | "reservations" | "waitlist" | "guests" | "settings" | "help");

    return allowedByRole && (item.key === "restaurants" ? true : visiblePages.includes(item.key));
  });

  // Dynamic accent color style
  const accentStyle = accentColor ? { "--accent": accentColor } as React.CSSProperties : undefined;
  const activeClass = accentColor
    ? `bg-opacity-10 text-[var(--accent)]`
    : "bg-amber-50 text-amber-700";

  return (
    <div className="min-h-screen bg-gray-50" dir={dir} style={accentStyle}>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
          title={lang === "he" ? "פתח תפריט" : "Open menu"}
          aria-label={lang === "he" ? "פתח תפריט" : "Open menu"}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {restaurant?.name ?? (isSuperAdmin ? t.superAdmin.noRestaurantSelected : "OpenSeat")}
        </h1>
        <button
          onClick={() => setLang(lang === "he" ? "en" : "he")}
          className="p-2 -mr-2 text-gray-600 hover:text-gray-900 text-sm"
          title={lang === "he" ? "Switch to English" : "החלף לעברית"}
          aria-label={lang === "he" ? "Switch to English" : "החלף לעברית"}
        >
          🌐
        </button>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 ${sidebarSide} w-64 bg-white border-gray-200 p-4 flex flex-col z-50 transition-transform duration-200 ${
        sidebarOpen ? "translate-x-0" : lang === "he" ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="mb-8 flex items-center gap-3">
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
            title={lang === "he" ? "סגור תפריט" : "Close menu"}
            aria-label={lang === "he" ? "סגור תפריט" : "Close menu"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {logo ? (
            <img src={logo} alt="" className="w-8 h-8 rounded object-contain" />
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {restaurant?.name ?? (isSuperAdmin ? t.superAdmin.noRestaurantSelected : "OpenSeat")}
            </h1>
            <p className="text-sm text-gray-500">{t.nav.subtitle}</p>
            {isSuperAdmin ? (
              <p className="text-xs text-amber-700 mt-1">
                {restaurant ? t.superAdmin.currentPrefix + " " + restaurant.name : t.superAdmin.switchHint}
              </p>
            ) : null}
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Tooltip key={item.to} content={item.label} className="flex w-full">
              <NavLink
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? activeClass : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                <CountBadge count={item.count} />
              </NavLink>
            </Tooltip>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <Tooltip content={lang === "he" ? "Switch to English" : "החלף לעברית"} className="flex w-full">
            <button
              onClick={() => setLang(lang === "he" ? "en" : "he")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              title={lang === "he" ? "Switch to English" : "החלף לעברית"}
              aria-label={lang === "he" ? "Switch to English" : "החלף לעברית"}
            >
              <span>🌐</span>
              <span>{lang === "he" ? "English" : "עברית"}</span>
            </button>
          </Tooltip>
          <Tooltip content={t.nav.logout} className="flex w-full">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              title={t.nav.logout}
              aria-label={t.nav.logout}
            >
              <span>🚪</span>
              <span>{t.nav.logout}</span>
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main content */}
      <main className={`${mainMargin} p-4 sm:p-6 md:p-8 pt-16 md:pt-8 ${textAlign}`}>
        <Outlet />
      </main>

      <ChatWidget />
    </div>
  );
}
