import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import {
  useReservations,
  useUpdateReservation,
  useMarkNoShow,
  useCancelReservation,
  useCreateReservation,
  useCreateWalkIn,
  useVerifyClaimCode,
  useRedeemClaim,
} from "../hooks/api.js";
import type { RewardClaimVerified } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useToast } from "../components/Toast.js";
import { ModalPortal } from "../components/ModalPortal.js";
import { useLang } from "../i18n.js";
import {
  getAllowedReservationActions,
  getLatestReservationLifecycleEvent,
  getReservationLifecycleEvents,
  getReservationSourceTone,
} from "../lib/reservationLifecycle.js";
import type { Reservation, ReservationStatus } from "@openseat/domain";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-red-100 text-red-800",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  seated: "bg-green-100 text-green-800 hover:bg-green-200",
  completed: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-200",
  no_show: "bg-red-100 text-red-800 hover:bg-red-200",
};

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  seated: 2,
  completed: 3,
  cancelled: 4,
  no_show: 5,
};

const ALL_STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDayName(dateStr: string, t: any): string {
  const d = new Date(dateStr + "T12:00:00");
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  return t.settings.days[dayKeys[d.getDay()]] ?? "";
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "long" });
}

function getSourceLabel(source: Reservation["source"], t: ReturnType<typeof useLang>["t"]) {
  const keyMap = {
    walk_in: t.res.sourceWalkIn,
    phone: t.res.sourcePhone,
    web: t.res.sourceWeb,
    whatsapp: t.res.sourceWhatsapp,
    telegram: t.res.sourceTelegram,
  } satisfies Record<Reservation["source"], string>;

  return keyMap[source] ?? source;
}

function getActionLabel(status: ReservationStatus, t: ReturnType<typeof useLang>["t"]) {
  switch (status) {
    case "confirmed":
      return t.res.confirm;
    case "seated":
      return t.res.seat;
    case "completed":
      return t.res.complete;
    case "cancelled":
      return t.res.cancel;
    case "no_show":
      return t.res.markNoShow;
    default:
      return t.status[status as keyof typeof t.status] ?? status;
  }
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

function getLifecycleTimestampLabel(timestamp: string, lang: string) {
  return new Date(timestamp).toLocaleString(lang === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function ReservationsPage() {
  const { restaurant } = useCurrentRestaurant();
  const [date, setDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("time");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"reservation" | "walk_in">("reservation");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t, lang } = useLang();

  const dir = lang === "he" ? "text-right" : "text-left";
  const previousDayLabel = lang === "he" ? "יום קודם" : "Previous day";
  const nextDayLabel = lang === "he" ? "יום הבא" : "Next day";
  const clearSearchLabel = lang === "he" ? "נקה חיפוש" : "Clear search";

  const SORT_OPTIONS = [
    { value: "time", label: t.res.sortByTime },
    { value: "name", label: t.res.sortByName },
    { value: "partySize", label: t.res.sortByPartySize },
    { value: "status", label: t.res.sortByStatus },
  ] as const;

  const { data: reservations, isLoading } = useReservations({
    restaurantId: restaurant?.id,
    date,
  });

  const updateMutation = useUpdateReservation();
  const noShowMutation = useMarkNoShow();
  const cancelMutation = useCancelReservation();
  const { showToast } = useToast();

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Status counts computed from all reservations (before any filtering)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      total: 0,
      pending: 0,
      confirmed: 0,
      seated: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    if (!reservations) return counts;
    counts.total = reservations.length;
    for (const r of reservations) {
      if (counts[r.status] !== undefined) {
        counts[r.status]++;
      }
    }
    return counts;
  }, [reservations]);

  // Filter by status, then search, then sort
  const displayed = useMemo(() => {
    let list = reservations ?? [];

    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.guest?.name ?? "").toLowerCase().includes(q) ||
          (r.guest?.phone ?? "").includes(q),
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case "time":
        sorted.sort((a, b) => (a.timeStart ?? "").localeCompare(b.timeStart ?? ""));
        break;
      case "name":
        sorted.sort((a, b) =>
          (a.guest?.name ?? "").localeCompare(b.guest?.name ?? "", lang === "he" ? "he" : "en"),
        );
        break;
      case "partySize":
        sorted.sort((a, b) => b.partySize - a.partySize);
        break;
      case "status":
        sorted.sort(
          (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
        );
        break;
    }

    return sorted;
  }, [reservations, statusFilter, debouncedSearch, sortBy, lang]);

  function handleStatusChange(id: string, status: string) {
    const toastKeys: Record<string, string> = {
      confirmed: t.res.toastConfirmed,
      seated: t.res.toastSeated,
      completed: t.res.toastCompleted,
      cancelled: t.res.toastCancelled,
    };
    updateMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => showToast(toastKeys[status] ?? t.res.toastStatusUpdated),
        onError: () => showToast(t.res.toastStatusError, "error"),
      },
    );
  }

  function handleQuickAction(id: string, status: ReservationStatus) {
    if (status === "cancelled") {
      cancelMutation.mutate(id, {
        onSuccess: () => showToast(t.res.toastCancelled),
        onError: () => showToast(t.res.toastStatusError, "error"),
      });
      return;
    }

    if (status === "no_show") {
      noShowMutation.mutate(id, {
        onSuccess: () => showToast(t.res.toastNoShow),
        onError: () => showToast(t.res.toastNoShowError, "error"),
      });
      return;
    }

    handleStatusChange(id, status);
  }

  function openCreateModal(mode: "reservation" | "walk_in") {
    setCreateMode(mode);
    setShowCreateModal(true);
  }

  function openPanel(r: Reservation) {
    setSelectedReservation(r);
  }

  function closePanel() {
    setSelectedReservation(null);
  }

  const currentDayName = getDayName(date, t);
  const isToday = date === todayStr();

  return (
    <div>
      {/* Page Title with count and date context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          {t.res.title}
          {reservations && reservations.length > 0 && (
            <span className="text-gray-400 font-normal mr-2">
              ({reservations.length})
            </span>
          )}
          <span className="block sm:inline text-sm sm:text-base font-normal text-gray-500 sm:mr-3">
            {t.res.dayPrefix}{currentDayName}{", "}{formatDate(date, lang)}
          </span>
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => openCreateModal("walk_in")}
            title={t.res.walkIn}
            aria-label={t.res.walkIn}
            className="px-4 py-2 bg-white text-red-700 border border-red-300 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            {t.res.walkIn}
          </button>
          <button
            onClick={() => openCreateModal("reservation")}
            title={t.res.create}
            aria-label={t.res.create}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            {t.res.create}
          </button>
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter("")}
          title={t.res.all}
          aria-label={t.res.all}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            statusFilter === ""
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {t.res.all}
          <span className="font-bold">{statusCounts.total}</span>
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            title={t.status[s as keyof typeof t.status]}
            aria-label={t.status[s as keyof typeof t.status]}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? "ring-2 ring-offset-1 ring-gray-400 " + (STATUS_BADGE_COLORS[s] ?? "")
                : STATUS_BADGE_COLORS[s] ?? ""
            }`}
          >
            {t.status[s as keyof typeof t.status]}
            <span className="font-bold">{statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filters Row: Date Nav + Search + Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Date Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            title={previousDayLabel}
            aria-label={previousDayLabel}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setDate(todayStr())}
            title={t.res.today}
            aria-label={t.res.today}
            className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              isToday
                ? "bg-red-50 border-red-300 text-red-700"
                : "border-gray-300 hover:bg-gray-50 text-gray-700"
            }`}
          >
            {t.res.today}
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            title={nextDayLabel}
            aria-label={nextDayLabel}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Status Filter Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t.res.allStatuses}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{t.status[s as keyof typeof t.status]}</option>
          ))}
        </select>

        {/* Guest Search */}
        <div className="relative flex-1 sm:flex-none">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.res.search}
            className="px-3 py-2 pr-3 pl-8 border border-gray-300 rounded-lg text-sm w-full sm:w-56"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
              title={clearSearchLabel}
              aria-label={clearSearchLabel}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500">{t.res.loading}</div>
        ) : !displayed || displayed.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">{t.res.noResults}</p>
              <button
                onClick={() => openCreateModal("reservation")}
                title={t.res.create}
                aria-label={t.res.create}
                className="mt-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                {t.res.create}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.res.time}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.res.guest}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.res.phone}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.res.partySize}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.res.statusCol}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.res.actions}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r: Reservation) => {
                  const lifecycleEvent = getLatestReservationLifecycleEvent(r);
                  const actions = getAllowedReservationActions(r.status);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => openPanel(r)}
                    >
                      <td className="px-4 py-3 font-mono">{r.timeStart?.slice(0, 5)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span>{r.guest?.name ?? "—"}</span>
                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${getReservationSourceTone(r.source)}`}>
                              {getSourceLabel(r.source, t)}
                            </span>
                            {getServiceSignals(r, t).map((signal) => (
                              <span key={signal} className="inline-flex rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-700">
                                {signal}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500">{r.guest?.phone ?? "—"}</td>
                      <td className="px-4 py-3">{r.partySize}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                            {t.status[r.status as keyof typeof t.status] ?? r.status}
                          </span>
                          {lifecycleEvent?.timestamp && (
                            <span className="text-[11px] text-gray-500">
                              {t.res.updatedAt} {getLifecycleTimestampLabel(lifecycleEvent.timestamp, lang)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {actions.length === 0 ? (
                            <span className="text-xs text-gray-400">{t.res.noActions}</span>
                          ) : (
                            actions.map((action) => (
                              <button
                                key={action}
                                onClick={() => handleQuickAction(r.id, action)}
                                title={getActionLabel(action, t)}
                                aria-label={getActionLabel(action, t)}
                                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                {getActionLabel(action, t)}
                              </button>
                            ))
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
              {displayed.map((r: Reservation) => {
                const lifecycleEvent = getLatestReservationLifecycleEvent(r);
                const actions = getAllowedReservationActions(r.status);
                return (
                  <div
                    key={r.id}
                    className="p-4 cursor-pointer active:bg-gray-50"
                    onClick={() => openPanel(r)}
                  >
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <span className="font-mono font-medium">{r.timeStart?.slice(0, 5)}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                        {t.status[r.status as keyof typeof t.status] ?? r.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">{r.guest?.name ?? "—"}</p>
                    <div className="flex items-center gap-2 text-[11px] mt-2 flex-wrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${getReservationSourceTone(r.source)}`}>
                        {getSourceLabel(r.source, t)}
                      </span>
                      {getServiceSignals(r, t).map((signal) => (
                        <span key={signal} className="inline-flex rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-700">
                          {signal}
                        </span>
                      ))}
                      {lifecycleEvent?.timestamp && (
                        <span className="text-gray-500">
                          {t.res.updatedAt} {getLifecycleTimestampLabel(lifecycleEvent.timestamp, lang)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                      <span>{r.guest?.phone ?? "—"}</span>
                      <span>{r.partySize} pax</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-3" onClick={(e) => e.stopPropagation()}>
                      {actions.length === 0 ? (
                        <span className="text-xs text-gray-400">{t.res.noActions}</span>
                      ) : (
                        actions.map((action) => (
                          <button
                            key={action}
                            onClick={() => handleQuickAction(r.id, action)}
                            title={getActionLabel(action, t)}
                            aria-label={getActionLabel(action, t)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                          >
                            {getActionLabel(action, t)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create Reservation Modal */}
      {showCreateModal && restaurant && (
        <CreateReservationModal
          restaurantId={restaurant.id}
          defaultDate={date}
          mode={createMode}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Reservation Detail Panel */}
      {selectedReservation && (
        <ReservationDetailPanel
          reservation={selectedReservation}
          onClose={closePanel}
          updateMutation={updateMutation}
          cancelMutation={cancelMutation}
          noShowMutation={noShowMutation}
        />
      )}
    </div>
  );
}

// ----- Detail Panel Component -----

function ReservationDetailPanel({
  reservation,
  onClose,
  updateMutation,
  cancelMutation,
  noShowMutation,
}: {
  reservation: Reservation;
  onClose: () => void;
  updateMutation: ReturnType<typeof useUpdateReservation>;
  cancelMutation: ReturnType<typeof useCancelReservation>;
  noShowMutation: ReturnType<typeof useMarkNoShow>;
}) {
  const { showToast } = useToast();
  const { t, lang } = useLang();
  const [editDate, setEditDate] = useState(reservation.date);
  const [editTime, setEditTime] = useState(reservation.timeStart?.slice(0, 5) ?? "");
  const [editPartySize, setEditPartySize] = useState(reservation.partySize);
  const [editNotes, setEditNotes] = useState(reservation.notes ?? "");
  const [editStatus, setEditStatus] = useState(reservation.status);
  const [saved, setSaved] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [verifiedClaim, setVerifiedClaim] = useState<RewardClaimVerified | null>(null);
  const verifyClaimMutation = useVerifyClaimCode();
  const redeemClaimMutation = useRedeemClaim();

  const lifecycleEvents = getReservationLifecycleEvents(reservation);
  const latestEvent = lifecycleEvents[0];
  const quickActions = getAllowedReservationActions(reservation.status);

  useEffect(() => {
    requestAnimationFrame(() => setPanelOpen(true));
  }, []);

  useEffect(() => {
    setEditDate(reservation.date);
    setEditTime(reservation.timeStart?.slice(0, 5) ?? "");
    setEditPartySize(reservation.partySize);
    setEditNotes(reservation.notes ?? "");
    setEditStatus(reservation.status);
  }, [reservation]);

  function handleSave() {
    updateMutation.mutate(
      {
        id: reservation.id,
        data: {
          date: editDate,
          timeStart: editTime,
          partySize: editPartySize,
          notes: editNotes,
          status: editStatus,
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          showToast(t.res.toastUpdated);
        },
        onError: () => showToast(t.res.toastUpdateError, "error"),
      },
    );
  }

  function handleCancel() {
    if (!confirm(t.res.confirmCancel)) return;
    cancelMutation.mutate(reservation.id, {
      onSuccess: (data: any) => {
        if (data?.waitlistMatch) {
          const match = data.waitlistMatch;
          showToast(`${t.res.waitlistMatch}: ${match.guestName} (${match.guestPhone})`);
        } else {
          showToast(t.res.toastCancelled);
        }
        onClose();
      },
      onError: () => showToast(t.res.toastStatusError, "error"),
    });
  }

  function handleMarkNoShow() {
    noShowMutation.mutate(reservation.id, {
      onSuccess: () => {
        showToast(t.res.toastNoShow);
        onClose();
      },
      onError: () => showToast(t.res.toastNoShowError, "error"),
    });
  }

  function handleQuickAction(action: ReservationStatus) {
    if (action === "cancelled") {
      handleCancel();
      return;
    }
    if (action === "no_show") {
      handleMarkNoShow();
      return;
    }

    updateMutation.mutate(
      { id: reservation.id, data: { status: action } },
      {
        onSuccess: () => {
          showToast(getActionLabel(action, t));
          onClose();
        },
        onError: () => showToast(t.res.toastStatusError, "error"),
      },
    );
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

  function handleClose() {
    setPanelOpen(false);
    setTimeout(onClose, 200);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-200 ${
          panelOpen ? "bg-opacity-30" : "bg-opacity-0"
        }`}
        onClick={handleClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-96 max-w-full bg-white shadow-xl border-l border-gray-200 transform transition-transform duration-200 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{t.res.details}</h3>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{reservation.guest?.name ?? "—"}</p>
                <p className="text-sm text-gray-500 font-mono mt-1">{reservation.guest?.phone ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${getReservationSourceTone(reservation.source)}`}>
                  {getSourceLabel(reservation.source, t)}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[reservation.status] ?? "bg-gray-100"}`}>
                  {t.status[reservation.status as keyof typeof t.status] ?? reservation.status}
                </span>
                {getServiceSignals(reservation, t).map((signal) => (
                  <span key={signal} className="inline-flex rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-700">
                    {signal}
                  </span>
                ))}
              </div>
              {latestEvent?.timestamp && (
                <p className="text-xs text-gray-500">
                  {t.res.updatedAt} {getLifecycleTimestampLabel(latestEvent.timestamp, lang)}
                </p>
              )}
              {reservation.guestId && (
                <a
                  href={`/guests/${reservation.guestId}`}
                  className="text-xs text-red-600 hover:underline inline-block"
                >
                  {t.res.viewGuestProfile}
                </a>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">{t.today.claimVerifyTitle}</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={claimCode}
                  onChange={(e) => {
                    setClaimCode(e.target.value);
                    setVerifiedClaim(null);
                  }}
                  placeholder={t.today.claimCodePlaceholder}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={handleVerifyClaim}
                  disabled={verifyClaimMutation.isPending || !claimCode.trim()}
                  className="px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {t.today.claimVerifyBtn}
                </button>
              </div>
              {verifiedClaim && (
                <div className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700">
                  <p>{t.today.claimRewardLabel}: {verifiedClaim.rewardName}</p>
                  {verifiedClaim.guestName ? <p>{t.today.claimGuestLabel}: {verifiedClaim.guestName}</p> : null}
                  {verifiedClaim.status === "active" ? (
                    <button
                      type="button"
                      onClick={handleRedeemClaim}
                      disabled={redeemClaimMutation.isPending}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {t.today.claimRedeemBtn}
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {quickActions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.res.actions}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleQuickAction(action)}
                      disabled={updateMutation.isPending || cancelMutation.isPending || noShowMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {getActionLabel(action, t)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.date}</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.timeStart}</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.partySize}</label>
              <select
                value={editPartySize}
                onChange={(e) => setEditPartySize(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.statusCol}</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ReservationStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{t.status[s as keyof typeof t.status]}</option>
                ))}
              </select>
            </div>

            {reservation.tableIds && reservation.tableIds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.tables}</label>
                <p className="text-sm text-gray-600">{reservation.tableIds.join(", ")}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.notes}</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                placeholder={t.res.notesPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.res.lifecycleTitle}</label>
              {lifecycleEvents.length === 0 ? (
                <p className="text-sm text-gray-500">{t.res.lifecycleEmpty}</p>
              ) : (
                <div className="space-y-2">
                  {lifecycleEvents.map((event) => (
                    <div key={`${event.key}-${event.timestamp}`} className="rounded-lg border border-gray-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          {t.status[event.key as keyof typeof t.status] ?? event.key}
                        </span>
                        <span className="text-xs text-gray-500">
                          {event.timestamp ? getLifecycleTimestampLabel(event.timestamp, lang) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? t.res.saving : t.res.save}
              </button>
              {saved && <span className="text-sm text-green-600">{t.res.saved}</span>}
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending || reservation.status === "cancelled"}
              className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? t.res.cancelling : t.res.cancelReservation}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Create Reservation Modal -----

function CreateReservationModal({
  restaurantId,
  defaultDate,
  mode,
  onClose,
}: {
  restaurantId: string;
  defaultDate: string;
  mode: "reservation" | "walk_in";
  onClose: () => void;
}) {
  const createMutation = useCreateReservation();
  const createWalkInMutation = useCreateWalkIn();
  const { showToast } = useToast();
  const { t } = useLang();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [timeStart, setTimeStart] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const isWalkIn = mode === "walk_in";
  const activeMutation = isWalkIn ? createWalkInMutation : createMutation;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (isWalkIn) {
      createWalkInMutation.mutate(
        {
          restaurantId,
          guestName,
          guestPhone,
          date,
          timeStart,
          partySize,
          notes: notes || undefined,
        },
        {
          onSuccess: () => {
            showToast(t.res.walkInCreated);
            onClose();
          },
          onError: (err) => setError(err.message || t.res.toastWalkInError),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        restaurantId,
        guestName,
        guestPhone,
        date,
        timeStart,
        partySize,
        notes: notes || undefined,
        source: "phone",
      },
      {
        onSuccess: () => {
          showToast(t.res.toastCreated);
          onClose();
        },
        onError: (err) => setError(err.message || t.res.toastCreateError),
      },
    );
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] bg-black/30"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isWalkIn ? t.res.walkInModalTitle : t.res.newReservation}
              </h3>
              {isWalkIn && (
                <p className="mt-1 text-sm text-gray-500">{t.res.walkInHelper}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 transition-colors hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${getReservationSourceTone(isWalkIn ? "walk_in" : "phone")}`}>
              {getSourceLabel(isWalkIn ? "walk_in" : "phone", t)}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.res.guestName}</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={t.res.fullName}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {isWalkIn ? t.res.guestPhoneOptional : t.res.guestPhone}
              </label>
              <input
                type="tel"
                required={!isWalkIn}
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="050-1234567"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.res.date}</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.res.timeStart}</label>
              <input
                type="time"
                required
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.res.partySize}</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.res.notes}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={t.res.notesOptional}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={activeMutation.isPending}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {activeMutation.isPending
                ? t.res.creating
                : (isWalkIn ? t.res.walkIn : t.res.createBtn)}
            </button>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
