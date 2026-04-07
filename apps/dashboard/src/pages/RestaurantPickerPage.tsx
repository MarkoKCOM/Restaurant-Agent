import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminRestaurants } from "../hooks/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { useLang } from "../i18n.js";

export function RestaurantPickerPage() {
  const navigate = useNavigate();
  const { switchRestaurant, restaurant: activeRestaurant } = useAuth();
  const { t, lang } = useLang();
  const { data, isLoading, error } = useAdminRestaurants();
  const [query, setQuery] = useState("");

  const restaurants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data ?? [];
    return (data ?? []).filter((restaurant) => {
      return [restaurant.name, restaurant.slug, restaurant.address ?? "", restaurant.cuisineType ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [data, query]);

  function handleSelect(restaurant: { id: string; name: string }) {
    switchRestaurant({ id: restaurant.id, name: restaurant.name });
    navigate("/today", { replace: true });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t.superAdmin.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{t.superAdmin.subtitle}</p>
        </div>
        <div className="w-full sm:w-80">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.superAdmin.searchLabel}
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.superAdmin.searchPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            dir={lang === "he" ? "rtl" : "ltr"}
          />
        </div>
      </div>

      {activeRestaurant ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t.superAdmin.currentPrefix} {activeRestaurant.name}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          {t.superAdmin.loading}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t.superAdmin.loadError}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          {t.superAdmin.empty}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((restaurant) => {
            const isActive = activeRestaurant?.id === restaurant.id;
            return (
              <button
                key={restaurant.id}
                type="button"
                onClick={() => handleSelect(restaurant)}
                className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isActive ? "border-amber-500 ring-2 ring-amber-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{restaurant.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">/{restaurant.slug}</p>
                  </div>
                  {isActive ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      {t.superAdmin.activeBadge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-800">{t.superAdmin.packageLabel}:</span>{" "}
                    {restaurant.package ?? "—"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">{t.superAdmin.adminsLabel}:</span>{" "}
                    {restaurant.adminCount}
                  </p>
                  <p className="min-h-[40px]">{restaurant.address ?? t.superAdmin.noAddress}</p>
                </div>

                <div className="mt-4 inline-flex items-center text-sm font-medium text-amber-700">
                  {t.superAdmin.openButton}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
