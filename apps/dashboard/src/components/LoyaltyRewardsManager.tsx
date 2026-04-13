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

export function LoyaltyRewardsManager({
  restaurant,
  actionColor = "var(--brand-primary)",
  showDashboardLink = false,
}: LoyaltyRewardsManagerProps) {
  const { t } = useLang();
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
