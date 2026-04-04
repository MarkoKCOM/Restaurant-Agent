import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  useWaitlist,
  useAddToWaitlist,
  useOfferSlot,
  useAcceptOffer,
  useCancelWaitlist,
  type WaitlistEntry,
} from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";

const STATUS_LABELS: Record<string, string> = {
  waiting: "ממתין",
  offered: "הוצע",
  accepted: "התקבל",
  expired: "פג תוקף",
};

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-800",
  offered: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-500",
};

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hebrewDayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return HEBREW_DAYS[d.getDay()] ?? "";
}

function formatHebrewDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDate();
  const months = [
    "בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
    "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר",
  ];
  return `${day} ${months[d.getMonth()]}`;
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;
      if (diff <= 0) {
        setRemaining("00:00");
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="text-sm font-mono text-blue-700">
      {remaining} {"נותר"}
    </span>
  );
}

export function WaitlistPage() {
  const { restaurant } = useCurrentRestaurant();
  const [date, setDate] = useState(todayStr());
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: waitlistEntries, isLoading } = useWaitlist(restaurant?.id, date);
  const offerMutation = useOfferSlot();
  const acceptMutation = useAcceptOffer();
  const cancelMutation = useCancelWaitlist();

  const dayName = hebrewDayName(date);
  const isToday = date === todayStr();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {"רשימת המתנה"}
          {waitlistEntries && waitlistEntries.length > 0 && (
            <span className="text-gray-400 font-normal mr-2">
              ({waitlistEntries.length})
            </span>
          )}
          <span className="text-base font-normal text-gray-500 mr-3">
            {"יום "}{dayName}{", "}{formatHebrewDate(date)}
          </span>
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          + {"הוסף לרשימת המתנה"}
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            title="יום קודם"
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
            {"היום"}
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
            title="יום הבא"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"אורח"}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"טלפון"}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"תאריך"}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"טווח שעות"}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"סועדים"}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"סטטוס"}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{"פעולות"}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {"טוען..."}
                </td>
              </tr>
            ) : !waitlistEntries || waitlistEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-4xl">{"⏳"}</span>
                    <p className="text-gray-500 text-sm">
                      {"אין ממתינים ל-"}{formatHebrewDate(date)}{" (יום "}{dayName}{")"}
                    </p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                    >
                      {"+ הוסף לרשימת המתנה"}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              waitlistEntries.map((entry: WaitlistEntry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">{entry.guestName}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{entry.guestPhone}</td>
                  <td className="px-4 py-3">{entry.date}</td>
                  <td className="px-4 py-3 font-mono">
                    {entry.preferredTimeStart?.slice(0, 5)}
                    {" - "}
                    {entry.preferredTimeEnd?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">{entry.partySize}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100"}`}
                    >
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {entry.status === "waiting" && (
                        <>
                          <button
                            onClick={() => offerMutation.mutate(entry.id)}
                            disabled={offerMutation.isPending}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {"הצע מקום"}
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(entry.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {"בטל"}
                          </button>
                        </>
                      )}
                      {entry.status === "offered" && (
                        <>
                          {entry.expiresAt && <CountdownTimer expiresAt={entry.expiresAt} />}
                          <button
                            onClick={() => acceptMutation.mutate(entry.id)}
                            disabled={acceptMutation.isPending}
                            className="text-xs text-green-600 hover:underline"
                          >
                            {"אשר"}
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(entry.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {"בטל"}
                          </button>
                        </>
                      )}
                      {entry.status === "accepted" && (
                        <a
                          href="/reservations"
                          className="text-xs text-amber-600 hover:underline"
                        >
                          {"צפה בהזמנה"}
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add to Waitlist Modal */}
      {showAddModal && restaurant && (
        <AddToWaitlistModal
          restaurantId={restaurant.id}
          defaultDate={date}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ----- Add to Waitlist Modal -----

function AddToWaitlistModal({
  restaurantId,
  defaultDate,
  onClose,
}: {
  restaurantId: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const addMutation = useAddToWaitlist();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [preferredTimeStart, setPreferredTimeStart] = useState("");
  const [preferredTimeEnd, setPreferredTimeEnd] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    addMutation.mutate(
      {
        restaurantId,
        guestName,
        guestPhone,
        date,
        preferredTimeStart,
        preferredTimeEnd,
        partySize,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err.message || "שגיאה בהוספה לרשימת המתנה"),
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
            <h3 className="text-lg font-semibold text-gray-900">{"הוסף לרשימת המתנה"}</h3>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{"שם אורח"}</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="שם מלא"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{"טלפון"}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{"תאריך"}</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Time Range */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">{"משעה"}</label>
                <input
                  type="time"
                  required
                  value={preferredTimeStart}
                  onChange={(e) => setPreferredTimeStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">{"עד שעה"}</label>
                <input
                  type="time"
                  required
                  value={preferredTimeEnd}
                  onChange={(e) => setPreferredTimeEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Party Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{"מספר סועדים"}</label>
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

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? "שומר..." : "הוסף לרשימת המתנה"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
