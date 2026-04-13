import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRewards, useCreateReward, useUpdateReward } from "../hooks/api.js";
import { useToast } from "./Toast.js";
import { useLang } from "../i18n.js";
import { useAuth } from "../hooks/useAuth.js";
import type { Restaurant } from "@openseat/domain";

interface LoyaltyRewardsManagerProps {
  restaurant: Restaurant | null | undefined;
  actionColor?: string;
  showDashboardLink?: boolean;
}

type RewardTemplate = {
  id: string;
  title: { he: string; en: string };
  moment: { he: string; en: string };
  offer: { he: string; en: string };
  why: { he: string; en: string };
  pitch: { he: string; en: string };
  rewardNameHe: string;
  rewardNameEn: string;
  rewardDescriptionHe: string;
  rewardDescriptionEn: string;
  pointsCost: number;
};

const BFF_REWARD_TEMPLATES: RewardTemplate[] = [
  {
    id: "dessert-next-visit",
    title: { he: "חוזר מתוק", en: "Sweet comeback" },
    moment: { he: "לאורח חוזר שצריך עוד דחיפה קטנה", en: "For a returning guest who needs one small nudge" },
    offer: { he: "קינוח עלינו בביקור הבא", en: "Dessert on the next visit" },
    why: { he: "ברור, כיפי, ובדרך כלל זול יחסית למסעדה.", en: "Clear, generous, and usually margin-friendly for the restaurant." },
    pitch: { he: "בביקור הבא הקינוח עלינו.", en: "On your next visit, dessert is on us." },
    rewardNameHe: "קינוח עלינו בביקור הבא",
    rewardNameEn: "Dessert on your next visit",
    rewardDescriptionHe: "מעולה לאורח חוזר שצריך עוד סיבה טובה לקפוץ שוב.",
    rewardDescriptionEn: "Great for returning guests who just need a small reason to come back soon.",
    pointsCost: 80,
  },
  {
    id: "midweek-discount",
    title: { he: "אמצע שבוע חכם", en: "Midweek mover" },
    moment: { he: "לימים חלשים או לאורח שנעלם קצת", en: "For softer nights or a guest who has gone quiet" },
    offer: { he: "10% הנחה לאמצע שבוע", en: "10% off on a midweek visit" },
    why: { he: "ממלא ימים חלשים בלי לפגוע בסופ״ש החזק.", en: "Helps fill quieter nights without touching your strongest weekend demand." },
    pitch: { he: "אם בא לך לקפוץ באמצע שבוע, שמרתי לך 10% הנחה.", en: "If you feel like dropping by midweek, I saved you 10% off." },
    rewardNameHe: "10% הנחה לאמצע שבוע",
    rewardNameEn: "10% off midweek",
    rewardDescriptionHe: "הטבה חכמה להחזרת אורחים באמצע שבוע בלי לשרוף מבצעים על הימים החזקים.",
    rewardDescriptionEn: "A smart comeback offer for quieter nights without discounting peak days.",
    pointsCost: 120,
  },
  {
    id: "starter-for-table",
    title: { he: "פותחים שולחן", en: "Table starter" },
    moment: { he: "לחבר מביא חבר או לקבוצה קטנה", en: "For referrals or a small social group" },
    offer: { he: "מנה ראשונה לשולחן עלינו", en: "A starter for the table" },
    why: { he: "מרגיש נדיב ומעודד להזמין עוד אנשים.", en: "Feels generous and pushes guests to bring more people." },
    pitch: { he: "תבואו כמה חבר׳ה ויש לכם מנה ראשונה לשולחן עלינו.", en: "Come with a few friends and the table gets a starter on us." },
    rewardNameHe: "מנה ראשונה לשולחן עלינו",
    rewardNameEn: "Starter for the table",
    rewardDescriptionHe: "מעולה להזמנות חברתיות, מביאי חבר, וערבים שרוצים למלא שולחנות.",
    rewardDescriptionEn: "Great for social bookings, referrals, and nights where you want fuller tables.",
    pointsCost: 140,
  },
  {
    id: "birthday-table-treat",
    title: { he: "יום הולדת כמו שצריך", en: "Birthday table treat" },
    moment: { he: "לימי הולדת וחגיגות", en: "For birthdays and celebration tables" },
    offer: { he: "צ׳ופר יום הולדת לשולחן", en: "Birthday treat for the table" },
    why: { he: "יוצר רגע זכיר ונותן לצוות משהו קל וברור להגיש.", en: "Creates a memorable moment and gives staff something easy to honor." },
    pitch: { he: "ביום הולדת אצלנו דואגים לכם לצ׳ופר קטן לשולחן.", en: "For birthdays with us, the table gets a little treat from the house." },
    rewardNameHe: "צ׳ופר יום הולדת לשולחן",
    rewardNameEn: "Birthday table treat",
    rewardDescriptionHe: "מושלם ליום הולדת, יום נישואין, או כל שולחן חגיגי שצריך להרגיש מיוחד.",
    rewardDescriptionEn: "Perfect for birthdays, anniversaries, or any celebration table that should feel special.",
    pointsCost: 180,
  },
  {
    id: "referral-dessert",
    title: { he: "חבר מביא חבר", en: "Bring-a-friend" },
    moment: { he: "כשבא לך לעודד המלצות טבעיות", en: "When you want easy word-of-mouth growth" },
    offer: { he: "קינוח עלינו לחבר מביא חבר", en: "Dessert on us for a referral" },
    why: { he: "פשוט להסביר, מרגיש הוגן, ועובד טוב בלי בירוקרטיה.", en: "Simple to explain, fair for both sides, and easy to honor." },
    pitch: { he: "תביא חבר חדש, ונדאג לכם לקינוח עלינו.", en: "Bring a new friend in and we’ll take care of dessert." },
    rewardNameHe: "קינוח עלינו לחבר מביא חבר",
    rewardNameEn: "Referral dessert on us",
    rewardDescriptionHe: "הטבה קלילה לעידוד המלצות אמיתיות בלי לסבך את השיחה.",
    rewardDescriptionEn: "A light, easy referral reward that keeps the message clean and natural.",
    pointsCost: 120,
  },
  {
    id: "host-perk",
    title: { he: "מארח שמביא שולחן", en: "Host perk" },
    moment: { he: "לקבוצות 6+ או אורח שתמיד מארגן את החבורה", en: "For 6+ groups or the guest who always organizes the crew" },
    offer: { he: "צ׳ופר למארח קבוצה", en: "Host perk for a group booking" },
    why: { he: "נותן לאדם אחד סיבה טובה לאסוף את כולם דווקא אליך.", en: "Gives one person a real reason to gather everyone at your place." },
    pitch: { he: "על קבוצה יפה אצלנו, יש צ׳ופר קטן למארח.", en: "For a proper group booking, the host gets a little extra from us." },
    rewardNameHe: "צ׳ופר למארח קבוצה",
    rewardNameEn: "Host perk for group booking",
    rewardDescriptionHe: "מעולה ליצירת הזמנות קבוצתיות ולחיזוק האורח שמביא את כל החבורה.",
    rewardDescriptionEn: "Great for group bookings and for rewarding the person who brings everyone together.",
    pointsCost: 220,
  },
];

export function LoyaltyRewardsManager({
  restaurant,
  actionColor = "var(--brand-primary)",
  showDashboardLink = false,
}: LoyaltyRewardsManagerProps) {
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const { canDo } = useAuth();
  const { data: rewardsData, isLoading } = useRewards(restaurant?.id, true);
  const createRewardMutation = useCreateReward();
  const updateRewardMutation = useUpdateReward();

  const [rewardNameHe, setRewardNameHe] = useState("");
  const [rewardNameEn, setRewardNameEn] = useState("");
  const [rewardPoints, setRewardPoints] = useState(120);
  const [rewardDescription, setRewardDescription] = useState("");

  const rewards = rewardsData?.rewards ?? [];
  const activeRewards = useMemo(() => rewards.filter((reward) => reward.isActive), [rewards]);
  const inactiveRewards = useMemo(() => rewards.filter((reward) => !reward.isActive), [rewards]);

  function handleCreateReward() {
    if (!restaurant?.id || !rewardNameHe.trim()) return;
    createRewardMutation.mutate(
      {
        restaurantId: restaurant.id,
        nameHe: rewardNameHe.trim(),
        nameEn: rewardNameEn.trim() || undefined,
        description: rewardDescription.trim() || undefined,
        pointsCost: rewardPoints,
      },
      {
        onSuccess: () => {
          setRewardNameHe("");
          setRewardNameEn("");
          setRewardDescription("");
          setRewardPoints(120);
          showToast(t.settings.membership_toastRewardCreated);
        },
        onError: () => showToast(t.settings.membership_toastError, "error"),
      },
    );
  }

  function handleToggleReward(id: string, isActive: boolean) {
    updateRewardMutation.mutate(
      { id, data: { isActive: !isActive } },
      {
        onSuccess: () => showToast(t.settings.membership_toastRewardUpdated),
        onError: () => showToast(t.settings.membership_toastError, "error"),
      },
    );
  }

  function handleUseTemplate(template: RewardTemplate) {
    setRewardNameHe(template.rewardNameHe);
    setRewardNameEn(template.rewardNameEn);
    setRewardDescription(lang === "he" ? template.rewardDescriptionHe : template.rewardDescriptionEn);
    setRewardPoints(template.pointsCost);
  }

  function RewardList({ title, items }: { title: string; items: typeof rewards }) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{t.settings.membership_noRewards}</p>
        ) : (
          <div className="space-y-3">
            {items.map((reward) => (
              <div key={reward.id} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{reward.nameHe}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          reward.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {reward.isActive ? t.settings.membership_active : t.settings.membership_inactive}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {reward.pointsCost} pts
                      {reward.description ? ` • ${reward.description}` : reward.nameEn ? ` • ${reward.nameEn}` : ""}
                    </p>
                  </div>

                  {canDo("loyalty.reward.manage") ? (
                    <button
                      type="button"
                      onClick={() => handleToggleReward(reward.id, reward.isActive)}
                      disabled={updateRewardMutation.isPending}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                        reward.isActive ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                      }`}
                    >
                      {reward.isActive ? t.settings.membership_deactivate : t.settings.membership_reactivate}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t.settings.membership_title}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.loyalty.manageRewardsHelp}</p>
        </div>
        {showDashboardLink ? (
          <Link
            to="/loyalty"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {t.loyalty.openDashboard}
          </Link>
        ) : null}
      </div>

      {restaurant?.package !== "growth" ? (
        <div>
          <p className="mb-3 text-sm text-gray-500">{t.settings.membership_lockedDesc}</p>
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {t.settings.membership_lockedTitle}
          </span>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-gray-500">{t.settings.loading}</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-900">{t.loyalty.templatesTitle}</h4>
              <p className="mt-1 text-sm text-gray-500">{t.loyalty.templatesHelp}</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {BFF_REWARD_TEMPLATES.map((template) => {
                const copy = {
                  title: template.title[lang],
                  moment: template.moment[lang],
                  offer: template.offer[lang],
                  why: template.why[lang],
                  pitch: template.pitch[lang],
                };

                return (
                  <article key={template.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-base font-semibold text-gray-900">{copy.title}</h5>
                        <p className="mt-1 text-sm text-gray-500">{copy.offer}</p>
                      </div>
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        {template.pointsCost} pts
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 text-sm text-gray-700">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t.loyalty.templateMoment}</p>
                        <p className="mt-1">{copy.moment}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t.loyalty.templateWhy}</p>
                        <p className="mt-1">{copy.why}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t.loyalty.templatePitch}</p>
                        <p className="mt-1 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-gray-600">{copy.pitch}</p>
                      </div>
                    </div>

                    {canDo("loyalty.reward.manage") ? (
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(template)}
                        className="mt-4 inline-flex rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {t.loyalty.useTemplate}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <RewardList title={t.loyalty.activeRewards} items={activeRewards} />
            <RewardList title={t.loyalty.inactiveRewards} items={inactiveRewards} />
          </div>

          {canDo("loyalty.reward.manage") ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900">{t.loyalty.createRewardTitle}</h4>
                <p className="mt-1 text-sm text-gray-500">{t.loyalty.createRewardHelp}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={rewardNameHe}
                  onChange={(e) => setRewardNameHe(e.target.value)}
                  placeholder={t.settings.membership_rewardNameHe}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={rewardNameEn}
                  onChange={(e) => setRewardNameEn(e.target.value)}
                  placeholder={t.settings.membership_rewardNameEn}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(Number(e.target.value) || 1)}
                  placeholder={t.settings.membership_rewardPoints}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={rewardDescription}
                  onChange={(e) => setRewardDescription(e.target.value)}
                  placeholder={t.settings.membership_rewardDesc}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleCreateReward}
                    disabled={createRewardMutation.isPending || !rewardNameHe.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: actionColor }}
                  >
                    {t.settings.membership_createReward}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
