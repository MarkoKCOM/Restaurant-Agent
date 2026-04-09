import { useState, useEffect, type FormEvent } from "react";
import {
  useWaitlist,
  useAddToWaitlist,
  useOfferSlot,
  useAcceptOffer,
  useCancelWaitlist,
  type WaitlistEntry,
} from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { ModalPortal } from "../components/ModalPortal.js";
import { useLang } from "../i18n.js";

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-800",
  offered: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-500",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayName(dateStr: string, lang: string, t: any): string {
  const d = new Date(dateStr + "T12:00:00");
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  return t.settings.days[dayKeys[d.getDay()]] ?? "";
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "long" });
}

function CountdownTimer({ expiresAt, t }: { expiresAt: string; t: any }) {
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
      {remaining} {t.waitlist.timeLeft}
    </span>
  );
}

export function WaitlistPage() {
  const { restaurant } = useCurrentRestaurant();
  const [date, setDate] = useState(todayStr());
  const [showAddModal, setShowAddModal] = useState(false);
  const { t, lang } = useLang();

  const dir = lang === "he" ? "text-right" : "text-left";
  const previousDayLabel = lang === "he" ? "יום קודם" : "Previous day";
  const nextDayLabel = lang === "he" ? "יום הבא" : "Next day";

  const { data: waitlistEntries, isLoading } = useWaitlist(restaurant?.id, date);
  const offerMutation = useOfferSlot();
  const acceptMutation = useAcceptOffer();
  const cancelMutation = useCancelWaitlist();

  const currentDayName = dayName(date, lang, t);
  const isToday = date === todayStr();

  const statusLabel = (status: string) => {
    const key = status as keyof typeof t.waitlist;
    return t.waitlist[key] ?? status;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {t.waitlist.title}
          {waitlistEntries && waitlistEntries.length > 0 && (
            <span className="text-gray-400 font-normal mr-2">
              ({waitlistEntries.length})
            </span>
          )}
          <span className="text-base font-normal text-gray-500 mr-3">
            {t.waitlist.dayPrefix}{currentDayName}{", "}{formatDate(date, lang)}
          </span>
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          title={t.waitlist.addToWaitlist}
          aria-label={t.waitlist.addToWaitlist}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          {t.waitlist.addToWaitlist}
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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
            title={t.waitlist.today}
            aria-label={t.waitlist.today}
            className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              isToday
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "border-gray-300 hover:bg-gray-50 text-gray-700"
            }`}
          >
            {t.waitlist.today}
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
      </div>

      {/* Desktop Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.guest}</th>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.phone}</th>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.date}</th>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.timeRange}</th>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.partySize}</th>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.statusCol}</th>
              <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.waitlist.actions}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t.waitlist.loading}
                </td>
              </tr>
            ) : !waitlistEntries || waitlistEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-4xl">{"⏳"}</span>
                    <p className="text-gray-500 text-sm">
                      {t.waitlist.noEntries}
                    </p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      title={t.waitlist.addToWaitlist}
                      aria-label={t.waitlist.addToWaitlist}
                      className="mt-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                    >
                      {t.waitlist.addToWaitlist}
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
                      {statusLabel(entry.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {entry.status === "waiting" && (
                        <>
                          <button
                            onClick={() => offerMutation.mutate(entry.id)}
                            disabled={offerMutation.isPending}
                            title={t.waitlist.offerTable}
                            aria-label={t.waitlist.offerTable}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {t.waitlist.offerTable}
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(entry.id)}
                            disabled={cancelMutation.isPending}
                            title={t.waitlist.cancelEntry}
                            aria-label={t.waitlist.cancelEntry}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {t.waitlist.cancelEntry}
                          </button>
                        </>
                      )}
                      {entry.status === "offered" && (
                        <>
                          {entry.expiresAt && <CountdownTimer expiresAt={entry.expiresAt} t={t} />}
                          <button
                            onClick={() => acceptMutation.mutate(entry.id)}
                            disabled={acceptMutation.isPending}
                            title={t.waitlist.accept}
                            aria-label={t.waitlist.accept}
                            className="text-xs text-green-600 hover:underline"
                          >
                            {t.waitlist.accept}
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(entry.id)}
                            disabled={cancelMutation.isPending}
                            title={t.waitlist.cancelEntry}
                            aria-label={t.waitlist.cancelEntry}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {t.waitlist.cancelEntry}
                          </button>
                        </>
                      )}
                      {entry.status === "accepted" && (
                        <a
                          href="/reservations"
                          title={t.waitlist.viewReservation}
                          aria-label={t.waitlist.viewReservation}
                          className="text-xs text-amber-600 hover:underline"
                        >
                          {t.waitlist.viewReservation}
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500">{t.waitlist.loading}</div>
        ) : !waitlistEntries || waitlistEntries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="text-4xl">{"⏳"}</span>
              <p className="text-gray-500 text-sm">{t.waitlist.noEntries}</p>
              <button
                onClick={() => setShowAddModal(true)}
                title={t.waitlist.addToWaitlist}
                aria-label={t.waitlist.addToWaitlist}
                className="mt-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                {t.waitlist.addToWaitlist}
              </button>
            </div>
          </div>
        ) : (
          waitlistEntries.map((entry: WaitlistEntry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900">{entry.guestName}</div>
                  <div className="text-sm text-gray-500 font-mono">{entry.guestPhone}</div>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100"}`}
                >
                  {statusLabel(entry.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                <span className="font-mono">
                  {entry.preferredTimeStart?.slice(0, 5)} - {entry.preferredTimeEnd?.slice(0, 5)}
                </span>
                <span>{entry.partySize} {t.waitlist.partySize}</span>
              </div>
              {entry.status === "offered" && entry.expiresAt && (
                <div className="mb-3">
                  <CountdownTimer expiresAt={entry.expiresAt} t={t} />
                </div>
              )}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                {entry.status === "waiting" && (
                  <>
                    <button
                      onClick={() => offerMutation.mutate(entry.id)}
                      disabled={offerMutation.isPending}
                      title={t.waitlist.offerTable}
                      aria-label={t.waitlist.offerTable}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {t.waitlist.offerTable}
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate(entry.id)}
                      disabled={cancelMutation.isPending}
                      title={t.waitlist.cancelEntry}
                      aria-label={t.waitlist.cancelEntry}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      {t.waitlist.cancelEntry}
                    </button>
                  </>
                )}
                {entry.status === "offered" && (
                  <>
                    <button
                      onClick={() => acceptMutation.mutate(entry.id)}
                      disabled={acceptMutation.isPending}
                      title={t.waitlist.accept}
                      aria-label={t.waitlist.accept}
                      className="text-xs font-medium text-green-600 hover:underline"
                    >
                      {t.waitlist.accept}
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate(entry.id)}
                      disabled={cancelMutation.isPending}
                      title={t.waitlist.cancelEntry}
                      aria-label={t.waitlist.cancelEntry}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      {t.waitlist.cancelEntry}
                    </button>
                  </>
                )}
                {entry.status === "accepted" && (
                  <a href="/reservations" className="text-xs font-medium text-amber-600 hover:underline">
                    {t.waitlist.viewReservation}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
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
  const { t } = useLang();
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
        onError: (err) => setError(err.message || t.waitlist.addError),
      },
    );
  }

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/30"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{t.waitlist.newEntry}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 transition-colors hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Guest Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.waitlist.guestName}</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={t.waitlist.fullName}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.waitlist.guestPhone}</label>
              <input
                type="tel"
                required
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="050-1234567"
              />
            </div>

            {/* Date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.waitlist.preferredDate}</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Time Range */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">{t.waitlist.preferredTimeStart}</label>
                <input
                  type="time"
                  required
                  value={preferredTimeStart}
                  onChange={(e) => setPreferredTimeStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">{t.waitlist.preferredTimeEnd}</label>
                <input
                  type="time"
                  required
                  value={preferredTimeEnd}
                  onChange={(e) => setPreferredTimeEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Party Size */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.waitlist.partySizeLabel}</label>
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

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {addMutation.isPending ? t.waitlist.creating : t.waitlist.addBtn}
            </button>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
