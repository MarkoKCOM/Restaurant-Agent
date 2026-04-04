import { Outlet, NavLink } from "react-router-dom";
import { useDashboard, useReservations, useGuests, useWaitlist } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";

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
  const { data: dashboard } = useDashboard(restaurant?.id);
  const { data: reservations } = useReservations({
    restaurantId: restaurant?.id,
    date: todayStr(),
  });
  const { data: guests } = useGuests(restaurant?.id);
  const { data: waitlistEntries } = useWaitlist(restaurant?.id, todayStr());

  // Count pending reservations (needs action)
  const pendingCount = reservations?.filter((r) => r.status === "pending").length ?? 0;
  const todayCount = dashboard?.today?.reservations ?? 0;
  const guestCount = guests?.length ?? 0;
  const waitingCount = waitlistEntries?.filter((w) => w.status === "waiting" || w.status === "offered").length ?? 0;

  const navItems = [
    { to: "/today", label: "היום", icon: "📅", count: todayCount },
    { to: "/reservations", label: "הזמנות", icon: "📋", count: pendingCount },
    { to: "/waitlist", label: "רשימת המתנה", icon: "⏳", count: waitingCount },
    { to: "/guests", label: "אורחים", icon: "👤", count: guestCount },
    { to: "/settings", label: "הגדרות", icon: "⚙️", count: 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 right-0 w-64 bg-white border-l border-gray-200 p-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Sable</h1>
          <p className="text-sm text-gray-500">ניהול מסעדה חכם</p>
        </div>
        <nav className="space-y-1">
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
      </aside>

      {/* Main content */}
      <main className="mr-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}
