import { useDashboard, useReservations, useTableStatus } from "../hooks/api.js";
import type { TableStatusItem } from "../hooks/api.js";
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

function OccupancyHeatmap({
  occupancyByHour,
  operatingHours,
}: {
  occupancyByHour: Record<string, number>;
  operatingHours?: Record<string, { open: string; close: string } | null>;
}) {
  // Determine today's operating hours
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayDay = dayNames[new Date().getDay()];
  const todayHours = operatingHours?.[todayDay];

  // Default hours if not set
  const open = todayHours?.open ?? "11:00";
  const close = todayHours?.close ?? "23:00";

  const slots = generateSlots(open, close);

  const maxCovers = Math.max(
    1,
    ...Object.values(occupancyByHour).filter((v) => v > 0),
  );

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
      {/* Legend */}
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

  const stats = dashboard?.today;
  const occupancyByHour = dashboard?.occupancyByHour;

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
                  <td className="px-4 py-3">{r.guest?.name ?? "---"}</td>
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
