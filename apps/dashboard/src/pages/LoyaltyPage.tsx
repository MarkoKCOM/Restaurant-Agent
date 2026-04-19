import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useGuests, useRewards } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useLang } from "../i18n.js";
import { LoyaltyRewardsManager } from "../components/LoyaltyRewardsManager.js";
import { isFeatureEnabled, type Guest } from "@openseat/domain";

const TIER_WEIGHT: Record<string, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

function formatTier(tier: string) {
  if (!tier) return "—";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function sortGuestsByPriority(a: Guest, b: Guest) {
  const tierDelta = (TIER_WEIGHT[b.tier] ?? 0) - (TIER_WEIGHT[a.tier] ?? 0);
  if (tierDelta !== 0) return tierDelta;
  return b.visitCount - a.visitCount;
}

function isReferralReward(reward: {
  templateKey?: string | null;
  recommendedMoments?: string[] | null;
  isActive: boolean;
}) {
  if (!reward.isActive) return false;
  return reward.recommendedMoments?.includes("referral") || reward.templateKey?.includes("referral") || false;
}

export function LoyaltyPage() {
  const { restaurant, isLoading } = useCurrentRestaurant();
  const { data: guests, isLoading: guestsLoading } = useGuests(restaurant?.id);
  const { data: rewardsData, isLoading: rewardsLoading } = useRewards(restaurant?.id, true);
  const { t } = useLang();

  const loyaltyEnabled = isFeatureEnabled("loyalty", restaurant?.dashboardConfig);
  const rewards = rewardsData?.rewards ?? [];
  const members = guests ?? [];

  const stats = useMemo(() => {
    const vipGuests = members.filter((guest) => guest.tier === "silver" || guest.tier === "gold").length;
    const optedOutGuests = members.filter((guest) => guest.optedOutCampaigns).length;
    const activeRewards = rewards.filter((reward) => reward.isActive).length;
    const repeatGuests = members.filter((guest) => guest.visitCount >= 2).length;
    const advocates = members.filter((guest) => guest.referralCode).length;
    const referredMembers = members.filter((guest) => guest.referredBy || guest.source === "referral").length;
    const referralReadyRewards = rewards.filter(isReferralReward).length;

    return {
      members: members.length,
      vipGuests,
      activeRewards,
      optedOutGuests,
      repeatGuests,
      advocates,
      referredMembers,
      referralReadyRewards,
    };
  }, [members, rewards]);

  const topMembers = useMemo(() => {
    return [...members].sort(sortGuestsByPriority).slice(0, 8);
  }, [members]);

  const topAdvocates = useMemo(() => {
    const referralCounts = new Map<string, number>();

    for (const guest of members) {
      if (!guest.referredBy) continue;
      referralCounts.set(guest.referredBy, (referralCounts.get(guest.referredBy) ?? 0) + 1);
    }

    return [...members]
      .filter((guest) => guest.referralCode || referralCounts.has(guest.id))
      .map((guest) => ({
        guest,
        referrals: referralCounts.get(guest.id) ?? 0,
      }))
      .sort((a, b) => {
        if (b.referrals !== a.referrals) return b.referrals - a.referrals;
        return sortGuestsByPriority(a.guest, b.guest);
      })
      .slice(0, 6);
  }, [members]);

  const referredMembers = useMemo(() => {
    const guestById = new Map(members.map((guest) => [guest.id, guest]));

    return [...members]
      .filter((guest) => guest.referredBy || guest.source === "referral")
      .sort(sortGuestsByPriority)
      .slice(0, 6)
      .map((guest) => ({
        guest,
        referrerName: guest.referredBy ? guestById.get(guest.referredBy)?.name : undefined,
      }));
  }, [members]);

  const referralRewards = useMemo(() => {
    return rewards.filter(isReferralReward).slice(0, 4);
  }, [rewards]);

  const referralProgramSummary = stats.referralReadyRewards > 0
    ? t.loyalty.referralProgramReady.replace("{n}", String(stats.referralReadyRewards))
    : t.loyalty.referralProgramMissing;

  if (isLoading) {
    return <p className="text-sm text-gray-500">{t.settings.loading}</p>;
  }

  if (!restaurant) {
    return null;
  }

  if (!loyaltyEnabled) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-gray-900">{t.loyalty.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">{t.loyalty.disabledDescription}</p>
        <Link
          to="/settings"
          className="mt-4 inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t.loyalty.openSettings}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t.loyalty.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">{t.loyalty.subtitle}</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">{t.loyalty.referralSpotlight}</p>
                <p className="mt-1 text-sm text-blue-800">{t.loyalty.referralSpotlightSummary}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                {restaurant.package === "growth" ? t.loyalty.growthEnabled : t.loyalty.lockedDescription}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white px-3 py-4">
                <p className="text-xs font-medium text-gray-500">{t.loyalty.overviewAdvocates}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.advocates}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-4">
                <p className="text-xs font-medium text-gray-500">{t.loyalty.overviewReferred}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.referredMembers}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-4">
                <p className="text-xs font-medium text-gray-500">{t.loyalty.referralReadyRewards}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.referralReadyRewards}</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-blue-900">{referralProgramSummary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: t.loyalty.overviewMembers, value: stats.members, tone: "bg-blue-50 text-blue-700" },
          { label: t.loyalty.overviewVip, value: stats.vipGuests, tone: "bg-red-50 text-red-700" },
          { label: t.loyalty.overviewRepeatGuests, value: stats.repeatGuests, tone: "bg-purple-50 text-purple-700" },
          { label: t.loyalty.overviewAdvocates, value: stats.advocates, tone: "bg-cyan-50 text-cyan-700" },
          { label: t.loyalty.overviewReferred, value: stats.referredMembers, tone: "bg-indigo-50 text-indigo-700" },
          { label: t.loyalty.overviewRewards, value: stats.activeRewards, tone: "bg-emerald-50 text-emerald-700" },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl p-5 ${card.tone}`}>
            <p className="text-sm font-medium">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t.loyalty.referralSpotlight}</h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">{t.loyalty.referralSpotlightHelp}</p>
          </div>
          <Link
            to="/guests"
            className="text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
          >
            {t.loyalty.viewAllGuests}
          </Link>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-4">
              <h4 className="text-base font-semibold text-gray-900">{t.loyalty.topAdvocates}</h4>
              <p className="mt-1 text-sm text-gray-500">{t.loyalty.topAdvocatesHelp}</p>
            </div>

            {guestsLoading ? (
              <p className="text-sm text-gray-500">{t.settings.loading}</p>
            ) : topAdvocates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                {t.loyalty.noAdvocates}
              </p>
            ) : (
              <div className="space-y-3">
                {topAdvocates.map(({ guest, referrals }) => (
                  <Link
                    key={guest.id}
                    to={`/guests/${guest.id}`}
                    className="block rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{guest.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{guest.phone}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                          {referrals} {t.loyalty.referralsLabel}
                        </span>
                        {guest.referralCode ? (
                          <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700">
                            {t.loyalty.referralCodeLabel}: {guest.referralCode}
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                          {guest.visitCount} {t.loyalty.visitsLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-4">
              <h4 className="text-base font-semibold text-gray-900">{t.loyalty.referredMembers}</h4>
              <p className="mt-1 text-sm text-gray-500">{t.loyalty.referredMembersHelp}</p>
            </div>

            {guestsLoading ? (
              <p className="text-sm text-gray-500">{t.settings.loading}</p>
            ) : referredMembers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                {t.loyalty.noReferredMembers}
              </p>
            ) : (
              <div className="space-y-3">
                {referredMembers.map(({ guest, referrerName }) => (
                  <Link
                    key={guest.id}
                    to={`/guests/${guest.id}`}
                    className="block rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{guest.name}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {t.loyalty.referredByLabel}: {referrerName ?? t.loyalty.directReferralSource}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                          {formatTier(guest.tier)}
                        </span>
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                          {guest.visitCount} {t.loyalty.visitsLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold text-red-900">{t.loyalty.referralReadyRewards}</h4>
              <p className="mt-1 text-sm text-red-800">{t.loyalty.referralReadyRewardsHelp}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {referralRewards.length === 0 ? (
              <p className="text-sm text-red-900">{t.loyalty.noReferralReadyRewards}</p>
            ) : (
              referralRewards.map((reward) => (
                <div key={reward.id} className="rounded-xl bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{reward.nameHe}</p>
                      {reward.description ? (
                        <p className="mt-1 text-sm text-gray-500">{reward.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800">
                        {reward.pointsCost} pts
                      </span>
                      {(reward.recommendedMoments ?? []).includes("referral") ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-800">
                          {t.loyalty.referralSpotlight}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t.loyalty.topMembers}</h3>
              <p className="mt-1 text-sm text-gray-500">{t.loyalty.topMembersHelp}</p>
            </div>
            <Link
              to="/guests"
              className="text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
            >
              {t.loyalty.viewAllGuests}
            </Link>
          </div>

          {guestsLoading ? (
            <p className="text-sm text-gray-500">{t.settings.loading}</p>
          ) : topMembers.length === 0 ? (
            <p className="text-sm text-gray-500">{t.loyalty.noMembers}</p>
          ) : (
            <div className="space-y-3">
              {topMembers.map((guest: Guest) => (
                <Link
                  key={guest.id}
                  to={`/guests/${guest.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{guest.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{guest.phone}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                      {guest.visitCount} {t.loyalty.visitsLabel}
                    </span>
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">
                      {formatTier(guest.tier)}
                    </span>
                    {guest.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">{t.loyalty.programHealth}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.loyalty.programHealthHelp}</p>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">{t.loyalty.optedOutGuests}</span>
                <span className="text-xl font-bold text-gray-900">{stats.optedOutGuests}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{t.loyalty.optedOutHelp}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">{t.loyalty.totalRewards}</span>
                <span className="text-xl font-bold text-gray-900">{rewards.length}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{t.loyalty.totalRewardsHelp}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">{t.loyalty.activeRewards}</span>
                <span className="text-xl font-bold text-gray-900">{stats.activeRewards}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{t.loyalty.activeRewardsHelp}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">{t.loyalty.referralReadyRewards}</span>
                <span className="text-xl font-bold text-gray-900">{stats.referralReadyRewards}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{t.loyalty.referralReadyRewardsHelp}</p>
            </div>
          </div>
        </section>
      </div>

      {rewardsLoading && restaurant.package === "growth" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t.settings.loading}
        </div>
      ) : null}

      <LoyaltyRewardsManager restaurant={restaurant} />
    </div>
  );
}
