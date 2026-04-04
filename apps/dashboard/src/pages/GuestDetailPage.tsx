import { useParams, useNavigate } from "react-router-dom";
import { useGuest } from "../hooks/api.js";
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

const TIER_LABELS: Record<string, string> = {
  bronze: "ברונזה",
  silver: "כסף",
  gold: "זהב",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-orange-100 text-orange-700",
  silver: "bg-gray-200 text-gray-700",
  gold: "bg-amber-100 text-amber-700",
};

export function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGuest(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        טוען...
      </div>
    );
  }

  if (!data?.guest) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        אורח לא נמצא
      </div>
    );
  }

  const { guest, reservations } = data;

  return (
    <div>
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/guests")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; חזרה לאורחים
        </button>
      </div>

      {/* Guest info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{guest.name}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="font-mono">{guest.phone}</span>
              {guest.email && <span>{guest.email}</span>}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${TIER_COLORS[guest.tier] ?? "bg-gray-100"}`}
          >
            {TIER_LABELS[guest.tier] ?? guest.tier}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg bg-blue-50 p-4 text-center">
            <p className="text-sm text-blue-600 font-medium">ביקורים</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {guest.visitCount}
            </p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600 font-medium">לא הגיע</p>
            <p className="text-2xl font-bold text-red-700 mt-1">
              {guest.noShowCount}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600 font-medium">מקור</p>
            <p className="text-lg font-bold text-gray-700 mt-1">
              {guest.source}
            </p>
          </div>
        </div>

        {/* Tags */}
        {guest.tags && guest.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {guest.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {guest.notes && (
          <div className="mt-4 text-sm text-gray-600">
            <span className="font-medium">הערות: </span>
            {guest.notes}
          </div>
        )}
      </div>

      {/* Reservation history */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">היסטוריית הזמנות</h3>
        {!reservations || reservations.length === 0 ? (
          <p className="text-gray-500 text-sm">אין הזמנות קודמות</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  תאריך
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  שעה
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  סועדים
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  סטטוס
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  מקור
                </th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: Reservation) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-mono">{r.date}</td>
                  <td className="px-4 py-3 font-mono">
                    {r.timeStart?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
