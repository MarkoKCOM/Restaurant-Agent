import { useState, useEffect } from "react";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import {
  useUpdateRestaurant,
  useTables,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
  useResetReservations,
} from "../hooks/api.js";
import { useToast } from "../components/Toast.js";
import type { Table } from "@sable/domain";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DAY_LABELS: Record<string, string> = {
  sun: "ראשון",
  mon: "שני",
  tue: "שלישי",
  wed: "רביעי",
  thu: "חמישי",
  fri: "שישי",
  sat: "שבת",
};

type HoursEntry = { open: string; close: string } | null;
type HoursState = Record<string, HoursEntry>;

const EMPTY_TABLE_FORM = { name: "", minSeats: 2, maxSeats: 4, zone: "" };

export function SettingsPage() {
  const { restaurant, isLoading } = useCurrentRestaurant();
  const { data: tablesList } = useTables(restaurant?.id);
  const updateMutation = useUpdateRestaurant();
  const createTableMutation = useCreateTable();
  const updateTableMutation = useUpdateTable();
  const deleteTableMutation = useDeleteTable();
  const resetMutation = useResetReservations();
  const { showToast } = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Hours editor state
  const [hours, setHours] = useState<HoursState>({});
  const [hoursDirty, setHoursDirty] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  // Table editor state
  const [showAddTable, setShowAddTable] = useState(false);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editTableForm, setEditTableForm] = useState(EMPTY_TABLE_FORM);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name ?? "");
      setPhone(restaurant.phone ?? "");
      setAddress(restaurant.address ?? "");
      const oh = (restaurant.operatingHours ?? {}) as HoursState;
      const normalized: HoursState = {};
      for (const day of DAYS) {
        normalized[day] = oh[day] ?? null;
      }
      setHours(normalized);
    }
  }, [restaurant]);

  function handleSave() {
    if (!restaurant) return;
    updateMutation.mutate(
      { id: restaurant.id, data: { name, phone, address } },
      {
        onSuccess: () => showToast("פרטי המסעדה נשמרו"),
        onError: () => showToast("שגיאה בשמירת פרטי המסעדה", "error"),
      },
    );
  }

  function handleHoursSave() {
    if (!restaurant) return;
    updateMutation.mutate(
      { id: restaurant.id, data: { operatingHours: hours } },
      {
        onSuccess: () => {
          setHoursDirty(false);
          setHoursSaved(true);
          setTimeout(() => setHoursSaved(false), 2000);
          showToast("שעות הפעילות נשמרו");
        },
        onError: () => showToast("שגיאה בשמירת שעות הפעילות", "error"),
      },
    );
  }

  function handleResetReservations() {
    if (!restaurant) return;
    resetMutation.mutate(restaurant.id, {
      onSuccess: (data) => {
        setShowResetConfirm(false);
        showToast(`${(data as { deleted: number }).deleted} הזמנות נמחקו`);
      },
      onError: () => {
        setShowResetConfirm(false);
        showToast("שגיאה במחיקת הזמנות", "error");
      },
    });
  }

  function toggleDay(day: string) {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: "10:00", close: "22:00" },
    }));
    setHoursDirty(true);
  }

  function setDayTime(day: string, field: "open" | "close", value: string) {
    setHours((prev) => {
      const existing = prev[day];
      if (!existing) return prev;
      return { ...prev, [day]: { ...existing, [field]: value } };
    });
    setHoursDirty(true);
  }

  function handleAddTable() {
    if (!restaurant || !tableForm.name.trim()) return;
    createTableMutation.mutate(
      {
        restaurantId: restaurant.id,
        name: tableForm.name.trim(),
        minSeats: tableForm.minSeats,
        maxSeats: tableForm.maxSeats,
        zone: tableForm.zone.trim() || undefined,
      },
      {
        onSuccess: () => {
          setTableForm(EMPTY_TABLE_FORM);
          setShowAddTable(false);
        },
      },
    );
  }

  function startEditTable(t: Table) {
    setEditingTableId(t.id);
    setEditTableForm({
      name: t.name,
      minSeats: t.minSeats,
      maxSeats: t.maxSeats,
      zone: t.zone ?? "",
    });
  }

  function handleSaveTable() {
    if (!editingTableId) return;
    updateTableMutation.mutate(
      {
        id: editingTableId,
        data: {
          name: editTableForm.name.trim(),
          minSeats: editTableForm.minSeats,
          maxSeats: editTableForm.maxSeats,
          zone: editTableForm.zone.trim() || undefined,
        },
      },
      { onSuccess: () => setEditingTableId(null) },
    );
  }

  function handleDeleteTable(id: string) {
    deleteTableMutation.mutate(id);
  }

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
        </section>

        {/* Operating hours editor */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">שעות פעילות</h3>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const h = hours[day];
              const isOpen = h !== null && h !== undefined;
              return (
                <div key={day} className="flex items-center gap-4 text-sm">
                  <span className="w-16 font-medium text-gray-700">{DAY_LABELS[day]}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={() => toggleDay(day)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className={isOpen ? "text-gray-700" : "text-gray-400"}>
                      {isOpen ? "פתוח" : "סגור"}
                    </span>
                  </label>
                  {isOpen && h && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.open}
                        onChange={(e) => setDayTime(day, "open", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="text-gray-400">—</span>
                      <input
                        type="time"
                        value={h.close}
                        onChange={(e) => setDayTime(day, "close", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleHoursSave}
              disabled={!hoursDirty || updateMutation.isPending}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "שומר..." : "שמור שעות"}
            </button>
            {hoursSaved && <span className="text-sm text-green-600">נשמר!</span>}
          </div>
        </section>

        {/* Tables editor */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">שולחנות</h3>
            <button
              onClick={() => setShowAddTable(!showAddTable)}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              {showAddTable ? "ביטול" : "+ הוסף שולחן"}
            </button>
          </div>

          {/* Add table form */}
          {showAddTable && (
            <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">שם</label>
                  <input
                    type="text"
                    value={tableForm.name}
                    onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                    placeholder="T1"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">מינ׳ מושבים</label>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.minSeats}
                    onChange={(e) => setTableForm({ ...tableForm, minSeats: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">מקס׳ מושבים</label>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.maxSeats}
                    onChange={(e) => setTableForm({ ...tableForm, maxSeats: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">אזור</label>
                  <input
                    type="text"
                    value={tableForm.zone}
                    onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value })}
                    placeholder="פנים / חוץ"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleAddTable}
                disabled={createTableMutation.isPending || !tableForm.name.trim()}
                className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {createTableMutation.isPending ? "שומר..." : "הוסף"}
              </button>
            </div>
          )}

          {!tablesList || tablesList.length === 0 ? (
            <p className="text-gray-500 text-sm">אין שולחנות</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {tablesList.map((t: Table) =>
                editingTableId === t.id ? (
                  <div
                    key={t.id}
                    className="border-2 border-amber-400 rounded-lg p-3 bg-amber-50"
                  >
                    <input
                      type="text"
                      value={editTableForm.name}
                      onChange={(e) => setEditTableForm({ ...editTableForm, name: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                    />
                    <div className="flex gap-2 mb-2">
                      <input
                        type="number"
                        min={1}
                        value={editTableForm.minSeats}
                        onChange={(e) =>
                          setEditTableForm({ ...editTableForm, minSeats: Number(e.target.value) })
                        }
                        className="w-1/2 px-2 py-1 border border-gray-300 rounded text-sm"
                        title="מינ׳"
                      />
                      <input
                        type="number"
                        min={1}
                        value={editTableForm.maxSeats}
                        onChange={(e) =>
                          setEditTableForm({ ...editTableForm, maxSeats: Number(e.target.value) })
                        }
                        className="w-1/2 px-2 py-1 border border-gray-300 rounded text-sm"
                        title="מקס׳"
                      />
                    </div>
                    <input
                      type="text"
                      value={editTableForm.zone}
                      onChange={(e) => setEditTableForm({ ...editTableForm, zone: e.target.value })}
                      placeholder="אזור"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveTable}
                        disabled={updateTableMutation.isPending}
                        className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        שמור
                      </button>
                      <button
                        onClick={() => setEditingTableId(null)}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={t.id}
                    className="border border-gray-200 rounded-lg p-3 text-center group relative"
                  >
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.minSeats}–{t.maxSeats} מושבים
                    </p>
                    {t.zone && (
                      <p className="text-xs text-gray-400 mt-1">{t.zone}</p>
                    )}
                    <div className="mt-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditTable(t)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        ערוך
                      </button>
                      <button
                        onClick={() => handleDeleteTable(t.id)}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        {/* Danger Zone */}
        <section className="bg-white rounded-xl border-2 border-red-300 p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-2">אזור מסוכן</h3>
          <p className="text-sm text-gray-600 mb-4">
            פעולות אלו הן בלתי הפיכות. נא להפעיל זהירות.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              מחק את כל ההזמנות
            </button>
            <span className="text-xs text-gray-400">מחיקת כל ההזמנות של המסעדה (לצורכי בדיקה)</span>
          </div>

          {/* Confirmation dialog */}
          {showResetConfirm && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black bg-opacity-30"
                onClick={() => setShowResetConfirm(false)}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm border-2 border-red-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 className="text-lg font-semibold text-red-700 mb-2">אישור מחיקה</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    האם למחוק את כל ההזמנות של המסעדה? פעולה זו בלתי הפיכה.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleResetReservations}
                      disabled={resetMutation.isPending}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {resetMutation.isPending ? "מוחק..." : "כן, מחק הכל"}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
