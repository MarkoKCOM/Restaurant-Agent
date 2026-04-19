import { useMemo, useState } from "react";
import { useDashboard, useReservations, useTableStatus, useUpdateReservation, useMarkNoShow, useTables, useVerifyClaimCode, useRedeemClaim } from "../hooks/api.js";
import type { RewardClaimVerified, TableStatusItem } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useToast } from "../components/Toast.js";
import { useLang } from "../i18n.js";
import { isFeatureEnabled } from "@openseat/domain";
import type { Reservation, Table } from "@openseat/domain";

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

const TABLE_STATUS_STYLES: Record<
  string,
  { bg: string; border: string; dot: string }
> = {
  available: {
    bg: "bg-green-50",
    border: "border-green-300",
    dot: "bg-green-500",
  },
  reserved: {
    bg: "bg-red-50",
    border: "border-red-300",
    dot: "bg-red-500",
  },
  occupied: {
    bg: "bg-red-50",
    border: "border-red-300",
    dot: "bg-red-500",
  },
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
  if (ratio < 0.25) return "bg-red-100";
  if (ratio < 0.5) return "bg-red-300";
  if (ratio < 0.75) return "bg-red-500 text-white";
  return "bg-red-700 text-white";
}

function formatCountdown(minutesUntil: number, t: ReturnType<typeof useLang>["t"]): string {
  if (minutesUntil <= 0) return t.today.now;
  if (minutesUntil < 60) return t.today.inMinutes.replace("{n}", String(minutesUntil));
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  if (mins === 0) {
    return hours === 1
      ? t.today.inHour
      : t.today.inHours.replace("{n}", String(hours));
  }
  return hours === 1
    ? t.today.inHourAndMinutes.replace("{n}", String(mins))
    : t.today.inHoursAndMinutes.replace("{h}", String(hours)).replace("{m}", String(mins));
}

function getClaimFeedbackMessage(
  error: unknown,
  t: ReturnType<typeof useLang>["t"],
  fallback: string,
): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("already redeemed")) return t.today.claimAlreadyRedeemed;
  if (message.includes("not found")) return t.today.claimNotFound;
  return fallback;
}

function OccupancyHeatmap({
  occupancyByHour,
  operatingHours,
}: {
  occupancyByHour: Record<string, number>;
  operatingHours?: Record<string, { open: string; close: string } | null>;
}) {
  const { t } = useLang();
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
      <h3 className="text-lg font-semibold mb-4">{t.today.occupancyByHour}</h3>
      <div className="flex gap-1 overflow-x-auto">
        {slots.map((slot) => {
          const covers = occupancyByHour[slot] ?? 0;
          return (
            <div
              key={slot}
              className={`flex flex-col items-center min-w-[48px] rounded-lg px-1 py-2 ${heatmapColor(covers, maxCovers)}`}
              title={`${slot} — ${covers} ${t.today.covers}`}
            >
              <span className="text-xs font-mono">{slot}</span>
              <span className="text-sm font-bold mt-1">{covers}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span>{t.today.empty}</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded bg-gray-100" />
          <div className="w-4 h-3 rounded bg-red-100" />
          <div className="w-4 h-3 rounded bg-red-300" />
          <div className="w-4 h-3 rounded bg-red-500" />
          <div className="w-4 h-3 rounded bg-red-700" />
        </div>
        <span>{t.today.full}</span>
      </div>
    </div>
  );
}

function getServiceSignals(reservation: Reservation, t: ReturnType<typeof useLang>["t"]) {
  const tags = (reservation.guest?.tags ?? []).map((tag) => tag.toLowerCase());
  const notes = `${reservation.notes ?? ""} ${reservation.guest?.notes ?? ""}`.toLowerCase();
  const items: string[] = [];
  if (tags.some((tag) => tag.includes("vip")) || reservation.guest?.tier === "gold") items.push(t.today.memberVip);
  if (tags.some((tag) => tag.includes("regular") || tag.includes("קבוע"))) items.push(t.today.memberRegular);
  if (/birthday|יום הולדת/.test(notes)) items.push(t.guestDetail.signalBirthday);
  if (/celebrat|anniversary|חוגג|חגיג/.test(notes)) items.push(t.guestDetail.signalCelebration);
  if (/owner friend|חבר בעלים/.test(notes)) items.push(t.guestDetail.signalOwnerFriend);
  if (/house comp|כבוד הבית|free stuff|comped/.test(notes)) items.push(t.guestDetail.signalHouseComp);
  return items;
}

function TableMap({ tables }: { tables: TableStatusItem[] }) {
  const { t } = useLang();

  const tableStatusLabels: Record<string, string> = {
    available: t.today.available,
    reserved: t.today.reserved,
    occupied: t.today.occupied,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold mb-4">{t.today.tableMap}</h3>
      {tables.length === 0 ? (
        <p className="text-gray-500 text-sm">{t.today.noTables}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map((tbl) => {
            const cfg = TABLE_STATUS_STYLES[tbl.status];
            return (
              <div
                key={tbl.tableId}
                className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 transition-colors`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900">{tbl.tableName}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                </div>
                <p className="text-xs text-gray-500 mb-1">{tbl.seats} {t.today.seats}</p>
                <p className="text-xs font-medium text-gray-700">{tableStatusLabels[tbl.status] ?? tbl.status}</p>
                {tbl.reservation && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-800 truncate">{tbl.reservation.guestName}</p>
                    <p className="text-xs text-gray-500">
                      {tbl.reservation.partySize} {t.today.covers} &middot; {tbl.reservation.timeStart}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        {Object.entries(TABLE_STATUS_STYLES).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span>{tableStatusLabels[key] ?? key}</span>
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
  const verifyClaimMutation = useVerifyClaimCode();
  const redeemClaimMutation = useRedeemClaim();
  const { showToast } = useToast();
  const { t, lang } = useLang();
  const [claimCode, setClaimCode] = useState("");
  const [verifiedClaim, setVerifiedClaim] = useState<RewardClaimVerified | null>(null);

  const textAlign = lang === "he" ? "text-right" : "text-left";

  const stats = dashboard?.today;
  const occupancyByHour = dashboard?.occupancyByHour;
  const loyaltyEnabled = isFeatureEnabled("loyalty", restaurant?.dashboardConfig);
  const tableMapEnabled = isFeatureEnabled("tableMap", restaurant?.dashboardConfig);
  const occupancyEnabled = isFeatureEnabled("occupancyHeatmap", restaurant?.dashboardConfig);

  // Build table ID -> name map
  const tableNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (tablesList) {
      for (const tbl of tablesList) {
        map[tbl.id] = tbl.name;
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
      confirmed: t.today.toastConfirmed,
      seated: t.today.toastSeated,
      completed: t.today.toastCompleted,
      cancelled: t.today.toastCancelled,
    };
    updateMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => showToast(labels[status] ?? t.today.toastStatusUpdated),
        onError: () => showToast(t.today.toastStatusError, "error"),
      },
    );
  }

  function handleNoShow(id: string) {
    noShowMutation.mutate(id, {
      onSuccess: () => showToast(t.today.toastNoShow),
      onError: () => showToast(t.today.toastNoShowError, "error"),
    });
  }

  function handleVerifyClaim() {
    const normalizedCode = claimCode.trim();
    if (!normalizedCode) return;
    verifyClaimMutation.mutate(normalizedCode, {
      onSuccess: ({ claim }) => {
        setVerifiedClaim(claim);
        showToast(claim.status === "redeemed" ? t.today.claimAlreadyRedeemed : t.today.claimVerified);
      },
      onError: (error) => {
        setVerifiedClaim(null);
        showToast(getClaimFeedbackMessage(error, t, t.today.claimVerifyError), "error");
      },
    });
  }

  function handleRedeemClaim() {
    const claimId = verifiedClaim?.id;
    if (!claimId) return;
    redeemClaimMutation.mutate(claimId, {
      onSuccess: ({ claim }) => {
        setVerifiedClaim(claim);
        setClaimCode("");
        showToast(t.today.claimRedeemed);
      },
      onError: (error) => showToast(getClaimFeedbackMessage(error, t, t.today.claimRedeemError), "error"),
    });
  }

  function getTableNames(tableIds?: string[]): string {
    if (!tableIds || tableIds.length === 0) return "\u2014";
    return tableIds.map((id) => tableNameMap[id] ?? id.slice(0, 6)).join(", ");
  }

  const statCards = [
    { label: t.today.reservations, value: stats?.reservations ?? 0, color: "bg-blue-50 text-blue-700" },
    { label: t.today.covers, value: stats?.covers ?? 0, color: "bg-green-50 text-green-700" },
    { label: t.today.cancellations, value: stats?.cancellations ?? 0, color: "bg-red-50 text-red-700" },
    { label: t.today.noShows, value: stats?.noShows ?? 0, color: "bg-red-50 text-red-700" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.today.title}</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <p className="text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Occupancy heatmap */}
      {occupancyEnabled && occupancyByHour && (
        <OccupancyHeatmap
          occupancyByHour={occupancyByHour}
          operatingHours={restaurant?.operatingHours}
        />
      )}

      {/* Table Map */}
      {tableMapEnabled && tableStatus && <TableMap tables={tableStatus} />}

      {/* Staff reward verification */}
      {loyaltyEnabled && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-base font-semibold mb-3">{t.today.claimVerifyTitle}</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={claimCode}
              onChange={(e) => {
                setClaimCode(e.target.value);
                setVerifiedClaim(null);
              }}
              placeholder={t.today.claimCodePlaceholder}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleVerifyClaim}
              disabled={verifyClaimMutation.isPending || !claimCode.trim()}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {t.today.claimVerifyBtn}
            </button>
            {verifiedClaim?.status === "active" && (
              <button
                type="button"
                onClick={handleRedeemClaim}
                disabled={redeemClaimMutation.isPending}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t.today.claimRedeemBtn}
              </button>
            )}
          </div>
          {verifiedClaim && (
            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700">
              <p>{t.today.claimRewardLabel}: {verifiedClaim.rewardName}</p>
              {verifiedClaim.guestName ? <p>{t.today.claimGuestLabel}: {verifiedClaim.guestName}</p> : null}
            </div>
          )}
        </div>
      )}

      {/* Next up countdown */}
      {nextUpId && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <span className="text-red-600 font-bold text-lg">&#9201;</span>
          <span className="text-sm font-medium text-red-800">
            {t.today.nextUp} {formatCountdown(minutesUntilNext, t)}
          </span>
        </div>
      )}

      {/* Reservations list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">{t.today.todayReservations}</h3>
        {!reservations || reservations.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {t.today.noReservations}
          </p>
        ) : (
          <>
          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={`${textAlign} px-4 py-3 font-medium text-gray-500`}>{t.today.time}</th>
                <th className={`${textAlign} px-4 py-3 font-medium text-gray-500`}>{t.today.guest}</th>
                <th className={`${textAlign} px-4 py-3 font-medium text-gray-500`}>{t.today.partySize}</th>
                <th className={`${textAlign} px-4 py-3 font-medium text-gray-500`}>{t.today.table}</th>
                <th className={`${textAlign} px-4 py-3 font-medium text-gray-500`}>{t.today.statusCol}</th>
                <th className={`${textAlign} px-4 py-3 font-medium text-gray-500`}>{t.today.actions}</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: Reservation) => {
                const isNextUp = r.id === nextUpId;
                const rowTint = STATUS_ROW_TINT[r.status] ?? "";
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 ${rowTint} ${isNextUp ? "ring-2 ring-red-400 ring-inset" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono">
                      {r.timeStart?.slice(0, 5)}
                      {isNextUp && (
                        <span className="mr-2 text-xs text-red-600 font-medium">&#8592; {t.today.next}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span>{r.guest?.name ?? "---"}</span>
                        <div className="flex flex-wrap gap-1">
                          {getServiceSignals(r, t).map((signal) => (
                            <span key={signal} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">{signal}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.partySize}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{getTableNames(r.tableIds)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                        {t.status[r.status as keyof typeof t.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {r.status === "pending" && (
                          <button
                            onClick={() => handleStatusChange(r.id, "confirmed")}
                            title={t.today.confirm}
                            aria-label={t.today.confirm}
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            {t.today.confirm}
                          </button>
                        )}
                        {r.status === "confirmed" && (
                          <button
                            onClick={() => handleStatusChange(r.id, "seated")}
                            title={t.today.seat}
                            aria-label={t.today.seat}
                            className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            {t.today.seat}
                          </button>
                        )}
                        {r.status === "seated" && (
                          <button
                            onClick={() => handleStatusChange(r.id, "completed")}
                            title={t.today.complete}
                            aria-label={t.today.complete}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            {t.today.complete}
                          </button>
                        )}
                        {(r.status === "pending" || r.status === "confirmed") && (
                          <button
                            onClick={() => handleStatusChange(r.id, "cancelled")}
                            title={t.today.cancel}
                            aria-label={t.today.cancel}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            {t.today.cancel}
                          </button>
                        )}
                        {(r.status === "confirmed" || r.status === "seated") && (
                          <button
                            onClick={() => handleNoShow(r.id)}
                            title={t.today.markNoShow}
                            aria-label={t.today.markNoShow}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            {t.today.markNoShow}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-gray-100">
            {reservations.map((r: Reservation) => {
              const isNextUp = r.id === nextUpId;
              const rowTint = STATUS_ROW_TINT[r.status] ?? "";
              return (
                <div
                  key={r.id}
                  className={`p-4 ${rowTint} ${isNextUp ? "ring-2 ring-red-400 ring-inset rounded-lg" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{r.timeStart?.slice(0, 5)}</span>
                      {isNextUp && (
                        <span className="text-xs text-red-600 font-medium">&#8592; {t.today.next}</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                      {t.status[r.status as keyof typeof t.status] ?? r.status}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{r.guest?.name ?? "---"}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {getServiceSignals(r, t).map((signal) => (
                      <span key={signal} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">{signal}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{r.partySize} {t.today.covers}</span>
                    <span>{getTableNames(r.tableIds)}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-3">
                    {r.status === "pending" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "confirmed")}
                        title={t.today.confirm}
                        aria-label={t.today.confirm}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        {t.today.confirm}
                      </button>
                    )}
                    {r.status === "confirmed" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "seated")}
                        title={t.today.seat}
                        aria-label={t.today.seat}
                        className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      >
                        {t.today.seat}
                      </button>
                    )}
                    {r.status === "seated" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "completed")}
                        title={t.today.complete}
                        aria-label={t.today.complete}
                        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        {t.today.complete}
                      </button>
                    )}
                    {(r.status === "pending" || r.status === "confirmed") && (
                      <button
                        onClick={() => handleStatusChange(r.id, "cancelled")}
                        title={t.today.cancel}
                        aria-label={t.today.cancel}
                        className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        {t.today.cancel}
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "seated") && (
                      <button
                        onClick={() => handleNoShow(r.id)}
                        title={t.today.markNoShow}
                        aria-label={t.today.markNoShow}
                        className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        {t.today.markNoShow}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
