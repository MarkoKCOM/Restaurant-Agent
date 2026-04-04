import { useState } from "react";
import { useReservations, useUpdateReservation, useMarkNoShow } from "../hooks/api.js";
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

export function ReservationsPage() {
  const { restaurant } = useCurrentRestaurant();
  const [date, setDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("");

  const { data: reservations, isLoading } = useReservations({
    restaurantId: restaurant?.id,
    date,
  });

  const updateMutation = useUpdateReservation();
  const noShowMutation = useMarkNoShow();

  const filtered = statusFilter
    ? reservations?.filter((r) => r.status === statusFilter)
    : reservations;

  function handleStatusChange(id: string, status: string) {
    updateMutation.mutate({ id, data: { status } });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">הזמנות</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="confirmed">מאושר</option>
          <option value="seated">יושב</option>
          <option value="completed">הושלם</option>
          <option value="cancelled">בוטל</option>
          <option value="no_show">לא הגיע</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">שעה</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">אורח</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">טלפון</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">סועדים</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  טוען...
                </td>
              </tr>
            ) : !filtered || filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  אין הזמנות לתאריך זה
                </td>
              </tr>
            ) : (
              filtered.map((r: Reservation) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-mono">{r.timeStart?.slice(0, 5)}</td>
                  <td className="px-4 py-3">{r.guest?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{r.guest?.phone ?? "—"}</td>
                  <td className="px-4 py-3">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "confirmed" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "seated")}
                        className="text-xs text-green-600 hover:underline ml-2"
                      >
                        הושב
                      </button>
                    )}
                    {r.status === "seated" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "completed")}
                        className="text-xs text-blue-600 hover:underline ml-2"
                      >
                        סיים
                      </button>
                    )}
                    {(r.status === "pending" || r.status === "confirmed") && (
                      <button
                        onClick={() => handleStatusChange(r.id, "cancelled")}
                        className="text-xs text-red-600 hover:underline ml-2"
                      >
                        בטל
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "seated") && (
                      <button
                        onClick={() => noShowMutation.mutate(r.id)}
                        className="text-xs text-orange-600 hover:underline ml-2"
                      >
                        לא הגיע
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
