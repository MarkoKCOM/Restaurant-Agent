import { useMemo } from "react";
import { useDashboard, useReservations, useTableStatus, useUpdateReservation, useMarkNoShow, useTables } from "../hooks/api.js";
import type { TableStatusItem } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useToast } from "../components/Toast.js";
import type { Reservation, Table } from "@sable/domain";

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

const STATUS_ROW_TINT: Record<string, string> = {
  pending: "bg-yellow-50/50",
  confirmed: "bg-blue-50/50",
  seated: "bg-green-50/50",
  completed: "bg-gray-50/50",
  cancelled: "bg-red-50/30",
  no_show: "bg-red-50/30",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Generate 30-min slots between open and close times (HH:MM format). */
function generateSlots(open: string, close: string): string[] {
  const slots: string[] = [];
  const [openH, openM] = open.split(":").map(Number);
  const [closeH, closeM] = close.split(":").map(Number);
  let minutes = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (minutes < end) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    minutes += 30;
  }
  return slots;
}

function heatmapColor(covers: number, max: number): string {
  if (covers === 0 || max === 0) return "bg-gray-100";
  const ratio = covers / max;
  if (ratio < 0.25) return "bg-amber-100";
  if (ratio < 0.5) return "bg-amber-300";
  if (ratio < 0.75) return "bg-amber-500 text-white";
  return "bg-amber-700 text-white";
}

function formatCountdown(minutesUntil: number): string {
  if (minutesUntil <= 0) return "עכשיו";
  if (minutesUntil < 60) return `בעוד ${minutesUntil} דקות`;
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  if (mins === 0) return `בעוד ${hours === 1 ? "שעה" : `${hours} שעות`}`;
  return `בעוד ${hours === 1 ? "שעה" : `${hours} שעות`} ו-${mins} דקות`;
}

function OccupancyHeatmap({
  occupancyByHour,
  operatingHours,
}: {
  occupancyByHour: Record<string, number>;
  operatingHours?: Record<string, { open: string; close: string } | null>;
}) {
  const dayNames = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ];
  const todayDay = dayNames[new Date().getDay()];
  const todayHours = operatingHours?.[todayDay];
  const open = todayHours?.open ?? "11:00";
  const close = todayHours?.close ?? "23:00";
  const slots = generateSlots(open, close);
  const maxCovers = Math.max(1, ...Object.values(occupancyByHour).filter((v) => v > 0));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold mb-4">תפוסה לפי שעה</h3>
      <div className="flex gap-1 overflow-x-auto">
        {slots.map((slot) => {
          const covers = occupancyByHour[slot] ?? 0;
          return (
            <div
              key={slot}
              className={`flex flex-col items-center min-w-[48px] rounded-lg px-1 py-2 ${heatmapColor(covers, maxCovers)}`}
              title={`${slot} — ${covers} סועדים`}
            >
              <span className="text-xs font-mono">{slot}</span>
              <span className="text-sm font-bold mt-1">{covers}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span>ריק</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded bg-gray-100" />
          <div className="w-4 h-3 rounded bg-amber-100" />
          <div className="w-4 h-3 rounded bg-amber-300" />
          <div className="w-4 h-3 rounded bg-amber-500" />
          <div className="w-4 h-3 rounded bg-amber-700" />
        </div>
        <span>מלא</span>
      </div>
    </div>
  );
}

const TABLE_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; dot: string }
> = {
  available: {
    label: "פנוי",
    bg: "bg-green-50",
    border: "border-green-300",
    dot: "bg-green-500",
  },
  reserved: {
    label: "מוזמן",
    bg: "bg-amber-50",
    border: "border-amber-300",
    dot: "bg-amber-500",
  },
  occupied: {
    label: "תפוס",
    bg: "bg-red-50",
    border: "border-red-300",
    dot: "bg-red-500",
  },
};

function TableMap({ tables }: { tables: TableStatusItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold mb-4">מפת שולחנות</h3>
      {tables.length === 0 ? (
        <p className="text-gray-500 text-sm">אין שולחנות מוגדרים.</p>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {tables.map((t) => {
            const cfg = TABLE_STATUS_CONFIG[t.status];
            return (
              <div
                key={t.tableId}
                className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 transition-colors`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900">{t.tableName}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                </div>
                <p className="text-xs text-gray-500 mb-1">{t.seats} מקומות</p>
                <p className="text-xs font-medium text-gray-700">{cfg.label}</p>
                {t.reservation && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-800 truncate">{t.reservation.guestName}</p>
                    <p className="text-xs text-gray-500">
                      {t.reservation.partySize} סועדים &middot; {t.reservation.timeStart}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        {Object.entries(TABLE_STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span>{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodayPage() {
  const { restaurant } = useCurrentRestaurant();
  const { data: dashboard } = useDashboard(restaurant?.id);
  const { data: reservations } = useReservations({
    restaurantId: restaurant?.id,
    date: todayStr(),
  });
  const { data: tableStatus } = useTableStatus(restaurant?.id);
  const { data: tablesList } = useTables(restaurant?.id);
  const updateMutation = useUpdateReservation();
  const noShowMutation = useMarkNoShow();
  const { showToast } = useToast();

  const stats = dashboard?.today;
  const occupancyByHour = dashboard?.occupancyByHour;

  // Build table ID -> name map
  const tableNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (tablesList) {
      for (const t of tablesList) {
        map[t.id] = t.name;
      }
    }
    return map;
  }, [tablesList]);

  // Find the "next up" reservation (closest future time)
  const { nextUpId, minutesUntilNext } = useMemo(() => {
    if (!reservations || reservations.length === 0) return { nextUpId: null, minutesUntilNext: 0 };
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let closestId: string | null = null;
    let closestDiff = Infinity;

    for (const r of reservations) {
      if (r.status === "cancelled" || r.status === "no_show" || r.status === "completed" || r.status === "seated") continue;
      const [h, m] = (r.timeStart ?? "00:00").split(":").map(Number);
      const resMinutes = h * 60 + m;
      const diff = resMinutes - nowMinutes;
      if (diff >= -15 && diff < closestDiff) {
        closestDiff = diff;
        closestId = r.id;
      }
    }

    return { nextUpId: closestId, minutesUntilNext: closestDiff === Infinity ? 0 : closestDiff };
  }, [reservations]);

  function handleStatusChange(id: string, status: string) {
    const labels: Record<string, string> = {
      confirmed: "ההזמנה אושרה",
      seated: "האורח הושב",
      completed: "ההזמנה הושלמה",
      cancelled: "ההזמנה בוטלה",
    };
    updateMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => showToast(labels[status] ?? "הסטטוס עודכן"),
        onError: () => showToast("שגיאה בעדכון הסטטוס", "error"),
      },
    );
  }

  function handleNoShow(id: string) {
    noShowMutation.mutate(id, {
      onSuccess: () => showToast("סומן כלא הגיע"),
      onError: () => showToast("שגיאה בסימון לא הגיע", "error"),
    });
  }

  function getTableNames(tableIds?: string[]): string {
    if (!tableIds || tableIds.length === 0) return "\u2014";
    return tableIds.map((id) => tableNameMap[id] ?? id.slice(0, 6)).join(", ");
  }

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

      {/* Occupancy heatmap */}
      {occupancyByHour && (
        <OccupancyHeatmap
          occupancyByHour={occupancyByHour}
          operatingHours={restaurant?.operatingHours}
        />
      )}

      {/* Table Map */}
      {tableStatus && <TableMap tables={tableStatus} />}

      {/* Next up countdown */}
      {nextUpId && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <span className="text-amber-600 font-bold text-lg">&#9201;</span>
          <span className="text-sm font-medium text-amber-800">
            ההזמנה הבאה: {formatCountdown(minutesUntilNext)}
          </span>
        </div>
      )}

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
                <th className="text-right px-4 py-3 font-medium text-gray-500">שולחן</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: Reservation) => {
                const isNextUp = r.id === nextUpId;
                const rowTint = STATUS_ROW_TINT[r.status] ?? "";
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 ${rowTint} ${isNextUp ? "ring-2 ring-amber-400 ring-inset" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono">
                      {r.timeStart?.slice(0, 5)}
                      {isNextUp && (
                        <span className="mr-2 text-xs text-amber-600 font-medium">&#8592; הבא</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.guest?.name ?? "---"}</td>
                    <td className="px-4 py-3">{r.partySize}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{getTableNames(r.tableIds)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {r.status === "pending" && (
                          <button
                            onClick={() => handleStatusChange(r.id, "confirmed")}
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            אשר
                          </button>
                        )}
                        {r.status === "confirmed" && (
                          <button
                            onClick={() => handleStatusChange(r.id, "seated")}
                            className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            הושב
                          </button>
                        )}
                        {r.status === "seated" && (
                          <button
                            onClick={() => handleStatusChange(r.id, "completed")}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            סיים
                          </button>
                        )}
                        {(r.status === "pending" || r.status === "confirmed") && (
                          <button
                            onClick={() => handleStatusChange(r.id, "cancelled")}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            בטל
                          </button>
                        )}
                        {(r.status === "confirmed" || r.status === "seated") && (
                          <button
                            onClick={() => handleNoShow(r.id)}
                            className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                          >
                            לא הגיע
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
