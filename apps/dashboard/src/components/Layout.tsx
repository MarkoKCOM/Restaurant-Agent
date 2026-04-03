import { Outlet, NavLink } from "react-router-dom";

const navItems = [
  { to: "/today", label: "היום", icon: "📅" },
  { to: "/reservations", label: "הזמנות", icon: "📋" },
  { to: "/guests", label: "אורחים", icon: "👤" },
  { to: "/settings", label: "הגדרות", icon: "⚙️" },
];

export function Layout() {
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
