import { useState } from "react";
import { Link } from "react-router-dom";
import { useAnalyticsSummary, useDailyMorningSummary, useLogDailyMorningSummary } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useLang } from "../i18n.js";
import { formatApiErrorMessage } from "../lib/apiError.js";

function dateKey(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function percent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function number(value: number | null | undefined) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

const copy = {
  he: {
    title: "אנליטיקה",
    subtitle: "תמונת מצב תפעולית ושיווקית לפי נתוני ההזמנות, המועדון והקמפיינים.",
    range: "120 ימים אחרונים",
    reservations: "הזמנות",
    bookings: "הזמנות",
    covers: "סועדים",
    cancelRate: "שיעור ביטול",
    noShowRate: "שיעור אי-הגעה",
    peakSlot: "שעת שיא",
    retention: "שימור",
    uniqueGuests: "אורחים פעילים",
    returningGuests: "חוזרים",
    returningRatio: "יחס חוזרים",
    visitsPerGuest: "ביקורים לאורח",
    loyalty: "מועדון",
    activeMembers: "חברים פעילים",
    pointsIssued: "נקודות שחולקו",
    pointsRedeemed: "נקודות שמומשו",
    redemptionRate: "שיעור מימוש",
    clv: "ערך לקוח",
    lifetimeRevenue: "הכנסה מצטברת",
    averageClv: "CLV ממוצע",
    payingGuests: "אורחים משלמים",
    spendPerVisit: "ממוצע לביקור",
    campaign: "קמפיינים",
    sent: "נשלחו",
    delivered: "נמסרו",
    replied: "השיבו",
    attributedRevenue: "הכנסה מיוחסת",
    tierDistribution: "חלוקת שכבות",
    retentionWindows: "חלונות שימור",
    occupancy: "תפוסה לפי שעה",
    topGuests: "לקוחות מובילים לפי CLV",
    openGuest: "פתח פרופיל",
    morningSummary: "סיכום בוקר לוואטסאפ",
    morningSummarySub: "הודעת הבוקר שבעלים מקבל: אתמול, היום, אורחים חשובים והתראות.",
    ownerReady: "וואטסאפ בעלים",
    ownerReadyYes: "מוגדר",
    ownerReadyNo: "חסר",
    summaryDate: "תאריך סיכום",
    notableGuests: "אורחים חשובים",
    alerts: "התראות",
    sendPreview: "רשום הודעה",
    sendingPreview: "רושם...",
    logSuccess: "הודעה נרשמה",
    morningSummaryError: "לא ניתן לטעון את סיכום הבוקר",
    morningSummaryLogError: "לא ניתן לרשום את הודעת הבוקר",
    partialErrorTitle: "חלק מנתוני האנליטיקה לא נטענו",
    empty: "אין נתונים לתקופה.",
    loading: "טוען אנליטיקה...",
    error: "לא ניתן לטעון אנליטיקה",
  },
  en: {
    title: "Analytics",
    subtitle: "Operating and growth metrics from reservations, loyalty, guest value, and campaigns.",
    range: "Last 120 days",
    reservations: "Reservations",
    bookings: "Bookings",
    covers: "Covers",
    cancelRate: "Cancel rate",
    noShowRate: "No-show rate",
    peakSlot: "Peak slot",
    retention: "Retention",
    uniqueGuests: "Active guests",
    returningGuests: "Returning",
    returningRatio: "Return ratio",
    visitsPerGuest: "Visits per guest",
    loyalty: "Loyalty",
    activeMembers: "Active members",
    pointsIssued: "Points issued",
    pointsRedeemed: "Points redeemed",
    redemptionRate: "Redemption rate",
    clv: "Customer value",
    lifetimeRevenue: "Lifetime revenue",
    averageClv: "Average CLV",
    payingGuests: "Paying guests",
    spendPerVisit: "Avg spend/visit",
    campaign: "Campaigns",
    sent: "Sent",
    delivered: "Delivered",
    replied: "Replied",
    attributedRevenue: "Attributed revenue",
    tierDistribution: "Tier distribution",
    retentionWindows: "Retention windows",
    occupancy: "Occupancy by slot",
    topGuests: "Top guests by CLV",
    openGuest: "Open profile",
    morningSummary: "WhatsApp morning summary",
    morningSummarySub: "The owner morning message: yesterday, today, notable guests, and alerts.",
    ownerReady: "Owner WhatsApp",
    ownerReadyYes: "Configured",
    ownerReadyNo: "Missing",
    summaryDate: "Summary date",
    notableGuests: "Notable guests",
    alerts: "Alerts",
    sendPreview: "Log message",
    sendingPreview: "Logging...",
    logSuccess: "Message logged",
    morningSummaryError: "Could not load morning summary",
    morningSummaryLogError: "Could not log morning summary",
    partialErrorTitle: "Some analytics data could not be loaded",
    empty: "No data for this period.",
    loading: "Loading analytics...",
    error: "Could not load analytics",
  },
};

function Metric({ label, value, tone = "default", embedded = false }: { label: string; value: string | number; tone?: "default" | "good" | "warn"; embedded?: boolean }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-gray-950";
  const className = embedded ? "py-2" : "rounded-lg border border-gray-200 bg-white p-4";
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Bar({ label, value, max, detail }: { label: string; value: number; max: number; detail: string }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[72px_1fr_92px] items-center gap-3 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <div className="h-3 rounded-full bg-gray-100">
        <div className="h-3 rounded-full bg-teal-600" style={{ width: `${width}%` }} />
      </div>
      <span className="text-right text-gray-500">{detail}</span>
    </div>
  );
}

export function AnalyticsPage() {
  const { restaurant, isLoading } = useCurrentRestaurant();
  const { lang } = useLang();
  const t = copy[lang];
  const [logFeedback, setLogFeedback] = useState("");
  const from = dateKey(-120);
  const to = dateKey(1);
  const analytics = useAnalyticsSummary({ restaurantId: restaurant?.id, from, to });
  const morningSummary = useDailyMorningSummary(restaurant?.id);
  const logMorningSummary = useLogDailyMorningSummary();
  const queries = [analytics.reservations, analytics.retention, analytics.loyalty, analytics.clv, analytics.campaignRoi];
  const loading = isLoading || queries.some((query) => query.isLoading);
  const analyticsErrors = [
    { label: t.reservations, error: analytics.reservations.error },
    { label: t.retention, error: analytics.retention.error },
    { label: t.loyalty, error: analytics.loyalty.error },
    { label: t.clv, error: analytics.clv.error },
    { label: t.campaign, error: analytics.campaignRoi.error },
  ].filter((item): item is { label: string; error: Error } => Boolean(item.error));

  if (loading) {
    return <div className="p-8 text-gray-500">{t.loading}</div>;
  }

  const reservations = analytics.reservations.data?.reservations.current;
  const retention = analytics.retention.data?.retention.current;
  const retentionWindows = analytics.retention.data?.retention.retentionWindows ?? [];
  const loyalty = analytics.loyalty.data?.loyalty;
  const clv = analytics.clv.data?.clv;
  const campaign = analytics.campaignRoi.data?.campaignRoi.totals;
  const morning = morningSummary.data?.summary;
  const maxTier = Math.max(1, ...(clv?.byTier ?? []).map((tier) => tier.guests));
  const maxSlot = Math.max(1, ...(reservations?.occupancyBySlot ?? []).map((slot) => slot.covers));

  async function handleLogMorningSummary() {
    if (!restaurant?.id) return;
    setLogFeedback("");
    try {
      const result = await logMorningSummary.mutateAsync({ restaurantId: restaurant.id });
      setLogFeedback(`${t.logSuccess}: ${result.outboundMessage.id} (${result.outboundMessage.status})`);
    } catch (err) {
      setLogFeedback(formatApiErrorMessage(err, t.morningSummaryLogError));
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">{t.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <span className="text-sm font-medium text-gray-500">{t.range}</span>
      </header>

      {analyticsErrors.length > 0 ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold text-red-900">{t.partialErrorTitle}</p>
          <ul className="mt-2 space-y-1">
            {analyticsErrors.map((item) => (
              <li key={item.label}>
                <span className="font-semibold">{item.label}: </span>
                {formatApiErrorMessage(item.error, t.error)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">{t.morningSummary}</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">{t.morningSummarySub}</p>
          </div>
          <button
            type="button"
            onClick={handleLogMorningSummary}
            disabled={!restaurant?.id || logMorningSummary.isPending}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {logMorningSummary.isPending ? t.sendingPreview : t.sendPreview}
          </button>
        </div>

        {morningSummary.isLoading ? (
          <p className="mt-5 text-sm text-gray-500">{t.loading}</p>
        ) : morningSummary.error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {formatApiErrorMessage(morningSummary.error, t.morningSummaryError)}
          </div>
        ) : morning ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label={t.summaryDate} value={morning.summaryDate} embedded />
              <Metric
                label={t.ownerReady}
                value={morning.ownerWhatsappConfigured ? t.ownerReadyYes : t.ownerReadyNo}
                tone={morning.ownerWhatsappConfigured ? "good" : "warn"}
                embedded
              />
              <Metric label={t.notableGuests} value={number(morning.notableGuests.length)} embedded />
              <Metric label={t.alerts} value={number(morning.alerts.length)} tone={morning.alerts.length > 0 ? "warn" : "good"} embedded />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">{morningSummary.data?.message}</pre>
            </div>
          </div>
        ) : null}
        {logFeedback && <p className="mt-4 text-sm font-medium text-gray-700">{logFeedback}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label={t.bookings} value={number(reservations?.bookings)} />
        <Metric label={t.covers} value={number(reservations?.covers)} />
        <Metric label={t.cancelRate} value={percent(reservations?.cancellationRate)} tone="warn" />
        <Metric label={t.noShowRate} value={percent(reservations?.noShowRate)} tone="warn" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-950">{t.occupancy}</h2>
            <span className="text-sm text-gray-500">{reservations?.peakSlot?.slot ?? t.empty}</span>
          </div>
          <div className="space-y-3">
            {(reservations?.occupancyBySlot ?? []).slice(0, 12).map((slot) => (
              <Bar key={slot.slot} label={slot.slot} value={slot.covers} max={maxSlot} detail={`${slot.covers}`} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-5 text-lg font-semibold text-gray-950">{t.retention}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t.uniqueGuests} value={number(retention?.uniqueGuests)} embedded />
            <Metric label={t.returningGuests} value={number(retention?.returningGuests)} embedded />
            <Metric label={t.returningRatio} value={percent(retention?.returningGuestRatio)} tone="good" embedded />
            <Metric label={t.visitsPerGuest} value={retention?.averageVisitsPerGuest ?? 0} embedded />
          </div>
          <h3 className="mt-6 mb-3 text-sm font-semibold text-gray-700">{t.retentionWindows}</h3>
          <div className="space-y-3">
            {retentionWindows.map((window) => (
              <Bar key={window.days} label={`${window.days}d`} value={window.retained} max={Math.max(1, window.cohortSize)} detail={percent(window.rate)} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-5 text-lg font-semibold text-gray-950">{t.loyalty}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t.activeMembers} value={number(loyalty?.activeMembers)} embedded />
            <Metric label={t.pointsIssued} value={number(loyalty?.pointsIssued)} embedded />
            <Metric label={t.pointsRedeemed} value={number(loyalty?.pointsRedeemed)} embedded />
            <Metric label={t.redemptionRate} value={percent(loyalty?.redemptionRate)} embedded />
          </div>
          <h3 className="mt-6 mb-3 text-sm font-semibold text-gray-700">{t.tierDistribution}</h3>
          <div className="space-y-3">
            {(clv?.byTier ?? []).map((tier) => (
              <Bar key={tier.tier} label={tier.tier} value={tier.guests} max={maxTier} detail={number(tier.guests)} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-5 text-lg font-semibold text-gray-950">{t.clv}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t.lifetimeRevenue} value={money(clv?.totals.lifetimeRevenue)} tone="good" embedded />
            <Metric label={t.averageClv} value={money(clv?.totals.averageLifetimeValue)} embedded />
            <Metric label={t.payingGuests} value={number(clv?.totals.guestsWithRevenue)} embedded />
            <Metric label={t.spendPerVisit} value={money(clv?.totals.averageSpendPerVisit)} embedded />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-5 text-lg font-semibold text-gray-950">{t.campaign}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t.sent} value={number(campaign?.sent)} embedded />
            <Metric label={t.delivered} value={number(campaign?.delivered)} embedded />
            <Metric label={t.replied} value={number(campaign?.replied)} embedded />
            <Metric label={t.attributedRevenue} value={money(campaign?.attributedRevenue)} tone="good" embedded />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-5 text-lg font-semibold text-gray-950">{t.topGuests}</h2>
          <div className="divide-y divide-gray-100">
            {(clv?.topGuests ?? []).map((guest) => (
              <div key={guest.guestId} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{guest.name}</p>
                  <p className="text-sm text-gray-500">{guest.tier} · {guest.lifetimeVisits} visits · {money(guest.averageSpendPerVisit)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-950">{money(guest.lifetimeRevenue)}</span>
                  <Link to={`/guests/${guest.guestId}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">
                    {t.openGuest}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
