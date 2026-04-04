import { useDashboard, useReservations } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import type { Reservation } from "@sable/domain";

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  confirmed: "מאושר",
  seated: "יושב",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הגיע",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-red-100 text-red-800",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function TodayPage() {
  const { restaurant } = useCurrentRestaurant();
  const { data: stats } = useDashboard(restaurant?.id);
  const { data: reservations } = useReservations({
    restaurantId: restaurant?.id,
    date: todayStr(),
  });

  const statCards = [
    { label: "הזמנות", value: stats?.reservations ?? 0, color: "bg-blue-50 text-blue-700" },
    { label: "סועדים", value: stats?.covers ?? 0, color: "bg-green-50 text-green-700" },
    { label: "ביטולים", value: stats?.cancellations ?? 0, color: "bg-amber-50 text-amber-700" },
    { label: "לא הגיעו", value: stats?.noShows ?? 0, color: "bg-red-50 text-red-700" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">היום</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <p className="text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Reservations list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">הזמנות להיום</h3>
        {!reservations || reservations.length === 0 ? (
          <p className="text-gray-500 text-sm">
            אין הזמנות להיום. הזמנות חדשות יופיעו כאן.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-500">שעה</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">אורח</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">סועדים</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: Reservation) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-mono">{r.timeStart?.slice(0, 5)}</td>
                  <td className="px-4 py-3">{r.guest?.name ?? "—"}</td>
                  <td className="px-4 py-3">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
