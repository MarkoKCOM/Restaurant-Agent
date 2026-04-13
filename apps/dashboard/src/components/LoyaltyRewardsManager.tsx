import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRewards, useCreateReward, useUpdateReward } from "../hooks/api.js";
import { useToast } from "./Toast.js";
import { useLang } from "../i18n.js";
import { useAuth } from "../hooks/useAuth.js";
import {
  BFF_REWARD_TEMPLATES,
  REWARD_MOMENT_LABELS,
  getRewardTemplateById,
  type Restaurant,
  type RewardTemplateDefinition,
} from "@openseat/domain";

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
  const [rewardTemplateKey, setRewardTemplateKey] = useState("");
  const [rewardRecommendedMoments, setRewardRecommendedMoments] = useState<string[]>([]);
  const [rewardPitchHe, setRewardPitchHe] = useState("");
  const [rewardPitchEn, setRewardPitchEn] = useState("");

  const rewards = rewardsData?.rewards ?? [];
  const activeRewards = useMemo(() => rewards.filter((reward) => reward.isActive), [rewards]);
  const inactiveRewards = useMemo(() => rewards.filter((reward) => !reward.isActive), [rewards]);

  const selectedTemplate = rewardTemplateKey ? getRewardTemplateById(rewardTemplateKey) : undefined;

  function handleCreateReward() {
    if (!restaurant?.id || !rewardNameHe.trim()) return;
    createRewardMutation.mutate(
      {
        restaurantId: restaurant.id,
        nameHe: rewardNameHe.trim(),
        nameEn: rewardNameEn.trim() || undefined,
        description: rewardDescription.trim() || undefined,
        pointsCost: rewardPoints,
        templateKey: rewardTemplateKey || undefined,
        recommendedMoments: rewardRecommendedMoments.length > 0 ? rewardRecommendedMoments : undefined,
        pitchHe: rewardPitchHe.trim() || undefined,
        pitchEn: rewardPitchEn.trim() || undefined,
      },
      {
        onSuccess: () => {
          setRewardNameHe("");
          setRewardNameEn("");
          setRewardDescription("");
          setRewardPoints(120);
          setRewardTemplateKey("");
          setRewardRecommendedMoments([]);
          setRewardPitchHe("");
          setRewardPitchEn("");
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

  function handleUseTemplate(template: RewardTemplateDefinition) {
    setRewardNameHe(template.rewardNameHe);
    setRewardNameEn(template.rewardNameEn);
    setRewardDescription(lang === "he" ? template.rewardDescriptionHe : template.rewardDescriptionEn);
    setRewardPoints(template.pointsCost);
    setRewardTemplateKey(template.id);
    setRewardRecommendedMoments(template.recommendedMoments);
    setRewardPitchHe(template.pitch.he);
    setRewardPitchEn(template.pitch.en);
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
            {items.map((reward) => {
              const rewardTemplate = getRewardTemplateById(reward.templateKey);
              const savedPitch = (lang === "he" ? reward.pitchHe : reward.pitchEn) || reward.pitchHe || reward.pitchEn;
              const momentLabels = (reward.recommendedMoments ?? [])
                .map((moment) => REWARD_MOMENT_LABELS[moment as keyof typeof REWARD_MOMENT_LABELS]?.[lang] ?? moment)
                .join(" • ");

              return (
                <div key={reward.id} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{reward.nameHe}</p>
                        {rewardTemplate ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            {rewardTemplate.title[lang]}
                          </span>
                        ) : null}
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
                      {momentLabels ? (
                        <p className="mt-2 text-xs text-gray-500">
                          <span className="font-semibold text-gray-600">{t.loyalty.templateMoment}: </span>
                          {momentLabels}
                        </p>
                      ) : null}
                      {savedPitch ? (
                        <p className="mt-1 text-xs text-gray-500">
                          <span className="font-semibold text-gray-600">{t.loyalty.templatePitch}: </span>
                          {savedPitch}
                        </p>
                      ) : null}
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
              );
            })}
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
                {selectedTemplate ? (
                  <div className="sm:col-span-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">{selectedTemplate.title[lang]}</p>
                    <p className="mt-1 text-amber-800">
                      <span className="font-semibold">{t.loyalty.templateMoment}: </span>
                      {selectedTemplate.recommendedMoments
                        .map((moment) => REWARD_MOMENT_LABELS[moment][lang])
                        .join(" • ")}
                    </p>
                    <p className="mt-1 text-amber-800">
                      <span className="font-semibold">{t.loyalty.templatePitch}: </span>
                      {(lang === "he" ? rewardPitchHe : rewardPitchEn) || rewardPitchHe || rewardPitchEn}
                    </p>
                  </div>
                ) : null}
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
