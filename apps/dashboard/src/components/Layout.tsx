import { Outlet, NavLink } from "react-router-dom";
import { useDashboard, useReservations, useGuests, useWaitlist } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useLang } from "../i18n.js";
import { useAuth } from "../hooks/useAuth.js";
import type { DashboardConfig } from "@openseat/domain";
import { ChatWidget } from "./ChatWidget.js";

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
  const { logout } = useAuth();
  const { data: dashboard } = useDashboard(restaurant?.id);
  const { data: reservations } = useReservations({
    restaurantId: restaurant?.id,
    date: todayStr(),
  });
  const { data: guests } = useGuests(restaurant?.id);
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
  const mainMargin = lang === "he" ? "mr-64" : "ml-64";
  const textAlign = lang === "he" ? "text-right" : "text-left";

  const allNavItems = [
    { to: "/today", key: "today", label: t.nav.today, icon: "📅", count: todayCount },
    { to: "/reservations", key: "reservations", label: t.nav.reservations, icon: "📋", count: pendingCount },
    { to: "/waitlist", key: "waitlist", label: t.nav.waitlist, icon: "⏳", count: waitingCount },
    { to: "/guests", key: "guests", label: t.nav.guests, icon: "👤", count: guestCount },
    { to: "/settings", key: "settings", label: t.nav.settings, icon: "⚙️", count: 0 },
    { to: "/help", key: "help", label: t.nav.help, icon: "❓", count: 0 },
  ];

  const navItems = allNavItems.filter((item) => visiblePages.includes(item.key));

  // Dynamic accent color style
  const accentStyle = accentColor ? { "--accent": accentColor } as React.CSSProperties : undefined;
  const activeClass = accentColor
    ? `bg-opacity-10 text-[var(--accent)]`
    : "bg-amber-50 text-amber-700";

  return (
    <div className="min-h-screen bg-gray-50" dir={dir} style={accentStyle}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 ${sidebarSide} w-64 bg-white border-gray-200 p-4 flex flex-col`}>
        <div className="mb-8 flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="" className="w-8 h-8 rounded object-contain" />
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{restaurant?.name ?? "OpenSeat"}</h1>
            <p className="text-sm text-gray-500">{t.nav.subtitle}</p>
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? activeClass : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <CountBadge count={item.count} />
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <button
            onClick={() => setLang(lang === "he" ? "en" : "he")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span>🌐</span>
            <span>{lang === "he" ? "English" : "עברית"}</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <span>🚪</span>
            <span>{t.nav.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`${mainMargin} p-8 ${textAlign}`}>
        <Outlet />
      </main>

      <ChatWidget />
    </div>
  );
}
