import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import {
  useReservations,
  useUpdateReservation,
  useMarkNoShow,
  useCancelReservation,
  useCreateReservation,
} from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useToast } from "../components/Toast.js";
import { useLang } from "../i18n.js";
import type { Reservation } from "@sable/domain";

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

export function ReservationsPage() {
  const { restaurant } = useCurrentRestaurant();
  const [date, setDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("time");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t, lang } = useLang();

  const dir = lang === "he" ? "text-right" : "text-left";

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {t.res.title}
          {reservations && reservations.length > 0 && (
            <span className="text-gray-400 font-normal mr-2">
              ({reservations.length})
            </span>
          )}
          <span className="text-base font-normal text-gray-500 mr-3">
            {t.res.dayPrefix}{currentDayName}{", "}{formatDate(date, lang)}
          </span>
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          {t.res.create}
        </button>
      </div>

      {/* Status Summary Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter("")}
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
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setDate(todayStr())}
            className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              isToday
                ? "bg-amber-50 border-amber-300 text-amber-700"
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
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.res.search}
            className="px-3 py-2 pr-3 pl-8 border border-gray-300 rounded-lg text-sm w-56"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
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
        <table className="w-full text-sm">
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
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {t.res.loading}
                </td>
              </tr>
            ) : !displayed || displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg
                      className="w-12 h-12 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-500 text-sm">
                      {t.res.noResults}
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                    >
                      {t.res.create}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              displayed.map((r: Reservation) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => openPanel(r)}
                >
                  <td className="px-4 py-3 font-mono">{r.timeStart?.slice(0, 5)}</td>
                  <td className="px-4 py-3">{r.guest?.name ?? "\u2014"}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{r.guest?.phone ?? "\u2014"}</td>
                  <td className="px-4 py-3">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}
                    >
                      {t.status[r.status as keyof typeof t.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {r.status === "confirmed" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "seated")}
                        className="text-xs text-green-600 hover:underline ml-2"
                      >
                        {t.res.seat}
                      </button>
                    )}
                    {r.status === "seated" && (
                      <button
                        onClick={() => handleStatusChange(r.id, "completed")}
                        className="text-xs text-blue-600 hover:underline ml-2"
                      >
                        {t.res.complete}
                      </button>
                    )}
                    {(r.status === "pending" || r.status === "confirmed") && (
                      <button
                        onClick={() => handleStatusChange(r.id, "cancelled")}
                        className="text-xs text-red-600 hover:underline ml-2"
                      >
                        {t.res.cancel}
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "seated") && (
                      <button
                        onClick={() => noShowMutation.mutate(r.id)}
                        className="text-xs text-orange-600 hover:underline ml-2"
                      >
                        {t.res.markNoShow}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Reservation Modal */}
      {showCreateModal && restaurant && (
        <CreateReservationModal
          restaurantId={restaurant.id}
          defaultDate={date}
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
}: {
  reservation: Reservation;
  onClose: () => void;
  updateMutation: ReturnType<typeof useUpdateReservation>;
  cancelMutation: ReturnType<typeof useCancelReservation>;
}) {
  const { showToast } = useToast();
  const { t } = useLang();
  const [editDate, setEditDate] = useState(reservation.date);
  const [editTime, setEditTime] = useState(reservation.timeStart?.slice(0, 5) ?? "");
  const [editPartySize, setEditPartySize] = useState(reservation.partySize);
  const [editNotes, setEditNotes] = useState(reservation.notes ?? "");
  const [editStatus, setEditStatus] = useState(reservation.status);
  const [saved, setSaved] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setPanelOpen(true));
  }, []);

  // Sync form if reservation changes
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
          showToast(
            `${t.res.waitlistMatch}: ${match.guestName} (${match.guestPhone})`,
          );
        }
        onClose();
      },
    });
  }

  function handleClose() {
    setPanelOpen(false);
    setTimeout(onClose, 200);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-200 ${
          panelOpen ? "bg-opacity-30" : "bg-opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Panel - slides from right in RTL (which is left in LTR DOM) */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-96 max-w-full bg-white shadow-xl border-l border-gray-200 transform transition-transform duration-200 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Guest info (read-only) */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">{reservation.guest?.name ?? "\u2014"}</p>
              <p className="text-sm text-gray-500 font-mono mt-1">{reservation.guest?.phone ?? "\u2014"}</p>
              {reservation.guestId && (
                <a
                  href={`/guests/${reservation.guestId}`}
                  className="text-xs text-amber-600 hover:underline mt-2 inline-block"
                >
                  {t.res.viewGuestProfile}
                </a>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.date}</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.timeStart}</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Party size */}
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

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.statusCol}</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as Reservation["status"])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{t.status[s as keyof typeof t.status]}</option>
                ))}
              </select>
            </div>

            {/* Tables */}
            {reservation.tableIds && reservation.tableIds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.tables}</label>
                <p className="text-sm text-gray-600">{reservation.tableIds.join(", ")}</p>
              </div>
            )}

            {/* Notes */}
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
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-gray-200 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
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
  onClose,
}: {
  restaurantId: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const createMutation = useCreateReservation();
  const { showToast } = useToast();
  const { t } = useLang();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [timeStart, setTimeStart] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
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
        onSuccess: () => { showToast(t.res.toastCreated); onClose(); },
        onError: (err) => setError(err.message || t.res.toastCreateError),
      },
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-30"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900">{t.res.newReservation}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Guest Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.guestName}</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder={t.res.fullName}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.guestPhone}</label>
              <input
                type="tel"
                required
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="050-1234567"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.date}</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.timeStart}</label>
              <input
                type="time"
                required
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Party Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.partySize}</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.res.notes}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                placeholder={t.res.notesOptional}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? t.res.creating : t.res.createBtn}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
