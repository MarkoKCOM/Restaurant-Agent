import { Outlet, NavLink } from "react-router-dom";
import { useDashboard, useReservations, useGuests, useWaitlist } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useLang } from "../i18n.js";
import { useAuth } from "../hooks/useAuth.js";

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

  const pendingCount = reservations?.filter((r) => r.status === "pending").length ?? 0;
  const todayCount = dashboard?.today?.reservations ?? 0;
  const guestCount = guests?.length ?? 0;
  const waitingCount = waitlistEntries?.filter((w) => w.status === "waiting" || w.status === "offered").length ?? 0;

  const dir = lang === "he" ? "rtl" : "ltr";
  const sidebarSide = lang === "he" ? "right-0 border-l" : "left-0 border-r";
  const mainMargin = lang === "he" ? "mr-64" : "ml-64";
  const textAlign = lang === "he" ? "text-right" : "text-left";

  const navItems = [
    { to: "/today", label: t.nav.today, icon: "📅", count: todayCount },
    { to: "/reservations", label: t.nav.reservations, icon: "📋", count: pendingCount },
    { to: "/waitlist", label: t.nav.waitlist, icon: "⏳", count: waitingCount },
    { to: "/guests", label: t.nav.guests, icon: "👤", count: guestCount },
    { to: "/settings", label: t.nav.settings, icon: "⚙️", count: 0 },
    { to: "/help", label: t.nav.help, icon: "❓", count: 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 ${sidebarSide} w-64 bg-white border-gray-200 p-4 flex flex-col`}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Sable</h1>
          <p className="text-sm text-gray-500">{t.nav.subtitle}</p>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-50 text-amber-700"
                    : "text-gray-600 hover:bg-gray-100"
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
    </div>
  );
}
