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

    return {
      members: members.length,
      vipGuests,
      activeRewards,
      optedOutGuests,
      repeatGuests,
    };
  }, [members, rewards]);

  const topMembers = useMemo(() => {
    return [...members]
      .sort((a, b) => {
        const tierDelta = (TIER_WEIGHT[b.tier] ?? 0) - (TIER_WEIGHT[a.tier] ?? 0);
        if (tierDelta !== 0) return tierDelta;
        return b.visitCount - a.visitCount;
      })
      .slice(0, 8);
  }, [members]);

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t.loyalty.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">{t.loyalty.subtitle}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {restaurant.package === "growth" ? t.loyalty.growthEnabled : t.loyalty.lockedDescription}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t.loyalty.overviewMembers, value: stats.members, tone: "bg-blue-50 text-blue-700" },
          { label: t.loyalty.overviewVip, value: stats.vipGuests, tone: "bg-amber-50 text-amber-700" },
          { label: t.loyalty.overviewRewards, value: stats.activeRewards, tone: "bg-emerald-50 text-emerald-700" },
          { label: t.loyalty.overviewRepeatGuests, value: stats.repeatGuests, tone: "bg-purple-50 text-purple-700" },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl p-5 ${card.tone}`}>
            <p className="text-sm font-medium">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

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
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
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
