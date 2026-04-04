import { useState, useEffect } from "react";
import {
  useReservations,
  useUpdateReservation,
  useMarkNoShow,
  useCancelReservation,
} from "../hooks/api.js";
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
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const { data: reservations, isLoading } = useReservations({
    restaurantId: restaurant?.id,
    date,
  });

  const updateMutation = useUpdateReservation();
  const noShowMutation = useMarkNoShow();
  const cancelMutation = useCancelReservation();

  const filtered = statusFilter
    ? reservations?.filter((r) => r.status === statusFilter)
    : reservations;

  function handleStatusChange(id: string, status: string) {
    updateMutation.mutate({ id, data: { status } });
  }

  function openPanel(r: Reservation) {
    setSelectedReservation(r);
  }

  function closePanel() {
    setSelectedReservation(null);
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
                <tr
                  key={r.id}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => openPanel(r)}
                >
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
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
        },
      },
    );
  }

  function handleCancel() {
    if (!confirm("האם לבטל את ההזמנה?")) return;
    cancelMutation.mutate(reservation.id, {
      onSuccess: () => onClose(),
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
            <h3 className="text-lg font-semibold text-gray-900">פרטי הזמנה</h3>
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
              <p className="text-sm font-medium text-gray-900">{reservation.guest?.name ?? "—"}</p>
              <p className="text-sm text-gray-500 font-mono mt-1">{reservation.guest?.phone ?? "—"}</p>
              {reservation.guestId && (
                <a
                  href={`/guests/${reservation.guestId}`}
                  className="text-xs text-amber-600 hover:underline mt-2 inline-block"
                >
                  צפה בפרופיל אורח
                </a>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שעה</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Party size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מספר סועדים</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as Reservation["status"])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="pending">ממתין</option>
                <option value="confirmed">מאושר</option>
                <option value="seated">יושב</option>
                <option value="completed">הושלם</option>
                <option value="cancelled">בוטל</option>
                <option value="no_show">לא הגיע</option>
              </select>
            </div>

            {/* Tables */}
            {reservation.tableIds && reservation.tableIds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שולחנות</label>
                <p className="text-sm text-gray-600">{reservation.tableIds.join(", ")}</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                placeholder="הערות להזמנה..."
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
                {updateMutation.isPending ? "שומר..." : "שמור שינויים"}
              </button>
              {saved && <span className="text-sm text-green-600">נשמר!</span>}
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending || reservation.status === "cancelled"}
              className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? "מבטל..." : "בטל הזמנה"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
