import { useState, useEffect } from "react";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useUpdateRestaurant, useTables } from "../hooks/api.js";
import type { Table } from "@sable/domain";

const DAY_LABELS: Record<string, string> = {
  sun: "ראשון",
  mon: "שני",
  tue: "שלישי",
  wed: "רביעי",
  thu: "חמישי",
  fri: "שישי",
  sat: "שבת",
};

export function SettingsPage() {
  const { restaurant, isLoading } = useCurrentRestaurant();
  const { data: tablesList } = useTables(restaurant?.id);
  const updateMutation = useUpdateRestaurant();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name ?? "");
      setPhone(restaurant.phone ?? "");
      setAddress(restaurant.address ?? "");
    }
  }, [restaurant]);

  function handleSave() {
    if (!restaurant) return;
    updateMutation.mutate({
      id: restaurant.id,
      data: { name, phone, address },
    });
  }

  const hours = (restaurant?.operatingHours ?? {}) as Record<
    string,
    { open: string; close: string } | null
  >;

  if (isLoading) return <p className="text-gray-500">טוען...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">הגדרות</h2>

      <div className="space-y-6">
        {/* Restaurant details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">פרטי המסעדה</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          {updateMutation.isSuccess && (
            <span className="mr-3 text-sm text-green-600">נשמר!</span>
          )}
        </section>

        {/* Operating hours */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">שעות פעילות</h3>
          <div className="space-y-2">
            {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => {
              const h = hours[day];
              return (
                <div key={day} className="flex items-center gap-4 text-sm">
                  <span className="w-16 font-medium text-gray-700">{DAY_LABELS[day]}</span>
                  {h ? (
                    <span className="text-gray-600">
                      {h.open} — {h.close}
                    </span>
                  ) : (
                    <span className="text-gray-400">סגור</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Tables */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">שולחנות</h3>
          {!tablesList || tablesList.length === 0 ? (
            <p className="text-gray-500 text-sm">אין שולחנות</p>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {tablesList.map((t: Table) => (
                <div
                  key={t.id}
                  className="border border-gray-200 rounded-lg p-3 text-center"
                >
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.minSeats}–{t.maxSeats} מושבים
                  </p>
                  {t.zone && (
                    <p className="text-xs text-gray-400 mt-1">{t.zone}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
