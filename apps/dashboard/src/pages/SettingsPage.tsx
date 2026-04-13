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
import { ModalPortal } from "../components/ModalPortal.js";
import { useLang } from "../i18n.js";
import type { Table, DashboardConfig } from "@openseat/domain";
import { resolveTheme } from "../lib/dashboardTheme.js";
import { LoyaltyRewardsManager } from "../components/LoyaltyRewardsManager.js";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DAY_KEYS: Record<string, string> = {
  sun: "sunday",
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
};

type HoursEntry = { open: string; close: string } | null;
type HoursState = Record<string, HoursEntry>;

const EMPTY_TABLE_FORM = { name: "", minSeats: 2, maxSeats: 4, zone: "" };

const ALL_PAGES = ["today", "reservations", "waitlist", "guests", "settings", "help"];
const FEATURE_KEYS = ["waitlist", "loyalty", "guestNotes", "occupancyHeatmap", "tableMap"] as const;

function DashboardCustomization({ restaurant, updateMutation }: { restaurant: any; updateMutation: any }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const config: DashboardConfig = restaurant?.dashboardConfig ?? {};

  const [primaryColor, setPrimaryColor] = useState(config.palette?.primary ?? config.accentColor ?? "#d97706");
  const [sidebarColor, setSidebarColor] = useState(config.palette?.sidebar ?? "#ffffff");
  const [sidebarTextColor, setSidebarTextColor] = useState(config.palette?.sidebarText ?? "#374151");
  const [surfaceColor, setSurfaceColor] = useState(config.palette?.surface ?? "#fffbeb");
  const [accentColor, setAccentColor] = useState(config.palette?.accent ?? config.accentColor ?? "#f59e0b");
  const [logoUrl, setLogoUrl] = useState(config.branding?.logo ?? config.logo ?? "");
  const [wordmarkUrl, setWordmarkUrl] = useState(config.branding?.wordmark ?? "");
  const [tagline, setTagline] = useState(config.branding?.tagline ?? "");
  const [pages, setPages] = useState<string[]>(config.visiblePages ?? ALL_PAGES);
  const [features, setFeatures] = useState(config.features ?? {
    waitlist: true, loyalty: true, guestNotes: true, occupancyHeatmap: true, tableMap: true,
  });

  useEffect(() => {
    const c = (restaurant?.dashboardConfig ?? {}) as DashboardConfig;
    setPrimaryColor(c.palette?.primary ?? c.accentColor ?? "#d97706");
    setSidebarColor(c.palette?.sidebar ?? "#ffffff");
    setSidebarTextColor(c.palette?.sidebarText ?? "#374151");
    setSurfaceColor(c.palette?.surface ?? "#fffbeb");
    setAccentColor(c.palette?.accent ?? c.accentColor ?? "#f59e0b");
    setLogoUrl(c.branding?.logo ?? c.logo ?? "");
    setWordmarkUrl(c.branding?.wordmark ?? "");
    setTagline(c.branding?.tagline ?? "");
    setPages(c.visiblePages ?? ALL_PAGES);
    setFeatures(c.features ?? { waitlist: true, loyalty: true, guestNotes: true, occupancyHeatmap: true, tableMap: true });
  }, [restaurant?.dashboardConfig]);

  function togglePage(page: string) {
    setPages((prev) => prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]);
  }

  function toggleFeature(key: string) {
    setFeatures((prev: any) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetBranding() {
    setPrimaryColor("#d97706");
    setSidebarColor("#ffffff");
    setSidebarTextColor("#374151");
    setSurfaceColor("#fffbeb");
    setAccentColor("#f59e0b");
    setLogoUrl("");
    setWordmarkUrl("");
    setTagline("");
  }

  function handleSave() {
    if (!restaurant?.id) return;
    const dashboardConfig: DashboardConfig = {
      accentColor: primaryColor,
      logo: logoUrl || undefined,
      branding: {
        logo: logoUrl || undefined,
        wordmark: wordmarkUrl || undefined,
        tagline: tagline || undefined,
      },
      palette: {
        primary: primaryColor,
        sidebar: sidebarColor,
        sidebarText: sidebarTextColor,
        surface: surfaceColor,
        accent: accentColor,
      },
      visiblePages: pages,
      features: features as DashboardConfig["features"],
    };
    updateMutation.mutate(
      { id: restaurant.id, data: { dashboardConfig } },
      {
        onSuccess: () => showToast(t.settings.toastCustomSaved),
        onError: () => showToast(t.settings.toastCustomError, "error"),
      },
    );
  }


  const pageLabels: Record<string, string> = {
    today: t.nav.today,
    reservations: t.nav.reservations,
    waitlist: t.nav.waitlist,
    guests: t.nav.guests,
    settings: t.nav.settings,
    help: t.nav.help,
  };

  const featureLabels: Record<string, string> = {
    waitlist: t.settings.feat_waitlist,
    loyalty: t.settings.feat_loyalty,
    guestNotes: t.settings.feat_guestNotes,
    occupancyHeatmap: t.settings.feat_occupancyHeatmap,
    tableMap: t.settings.feat_tableMap,
  };

  const previewTheme = resolveTheme(
    {
      accentColor: primaryColor,
      logo: logoUrl || undefined,
      branding: { logo: logoUrl || undefined, wordmark: wordmarkUrl || undefined, tagline: tagline || undefined },
      palette: {
        primary: primaryColor,
        sidebar: sidebarColor,
        sidebarText: sidebarTextColor,
        surface: surfaceColor,
        accent: accentColor,
      },
    },
    { isSuperAdmin: false, hasRestaurant: true },
  );

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">{t.settings.customization}</h3>
          <p className="text-sm text-gray-500">{t.settings.customizationDesc}</p>
        </div>
        <button
          onClick={resetBranding}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {t.settings.brand_resetDefaults}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.settings.brand_palette}</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                [t.settings.brand_primary, primaryColor, setPrimaryColor],
                [t.settings.brand_sidebar, sidebarColor, setSidebarColor],
                [t.settings.brand_sidebarText, sidebarTextColor, setSidebarTextColor],
                [t.settings.brand_surface, surfaceColor, setSurfaceColor],
                [t.settings.brand_accent, accentColor, setAccentColor],
              ].map(([label, value, setter]) => (
                <div key={label as string}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label as string}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={value as string} onChange={(e) => (setter as any)(e.target.value)} className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                    <input type="text" value={value as string} onChange={(e) => (setter as any)(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" dir="ltr" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.settings.brand_branding}</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.brand_logo}</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder={t.settings.logoPlaceholder} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.brand_wordmark}</label>
                <input value={wordmarkUrl} onChange={(e) => setWordmarkUrl(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.brand_tagline}</label>
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.settings.visiblePages}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PAGES.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => togglePage(page)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    pages.includes(page)
                      ? "bg-[color:var(--brand-surface)] border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}
                >
                  {pageLabels[page] ?? page}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.settings.featureToggles}</label>
            <div className="space-y-2">
              {FEATURE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!(features as any)[key]} onChange={() => toggleFeature(key)} className="w-4 h-4 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">{featureLabels[key]}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {updateMutation.isPending ? t.settings.saving : t.settings.saveCustomization}
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.settings.brand_preview}</h4>
            <div className="rounded-2xl overflow-hidden border border-gray-200" style={previewTheme.cssVars}>
              <div className="p-4" style={{ backgroundColor: "var(--brand-sidebar)", color: "var(--brand-sidebar-text)" }}>
                <div className="flex items-center gap-3">
                  {logoUrl ? <img src={logoUrl} alt="" className="w-10 h-10 rounded object-contain bg-white/70" /> : null}
                  <div>
                    <p className="font-semibold">{restaurant?.name}</p>
                    <p className="text-sm opacity-75">{tagline || t.nav.subtitle}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white">
                <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: "var(--brand-surface)" }}>
                  <div className="w-24 h-3 rounded-full mb-2" style={{ backgroundColor: "var(--brand-primary)" }} />
                  <div className="w-40 h-2 rounded-full bg-gray-200" />
                </div>
                <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: "var(--brand-primary)" }}>
                  {t.settings.saveCustomization}
                </button>
              </div>
            </div>
          </div>

          <LoyaltyRewardsManager restaurant={restaurant} actionColor={primaryColor} showDashboardLink />
        </div>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { restaurant, isLoading } = useCurrentRestaurant();
  const { data: tablesList } = useTables(restaurant?.id);
  const updateMutation = useUpdateRestaurant();
  const createTableMutation = useCreateTable();
  const updateTableMutation = useUpdateTable();
  const deleteTableMutation = useDeleteTable();
  const resetMutation = useResetReservations();
  const { showToast } = useToast();
  const { t, lang } = useLang();
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
        onSuccess: () => showToast(t.settings.toastDetailsSaved),
        onError: () => showToast(t.settings.toastDetailsError, "error"),
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
          showToast(t.settings.toastHoursSaved);
        },
        onError: () => showToast(t.settings.toastHoursError, "error"),
      },
    );
  }

  function handleResetReservations() {
    if (!restaurant) return;
    resetMutation.mutate(restaurant.id, {
      onSuccess: (data) => {
        setShowResetConfirm(false);
        showToast(`${(data as { deleted: number }).deleted} ${t.settings.resetReservations}`);
      },
      onError: () => {
        setShowResetConfirm(false);
        showToast(t.settings.toastResetError, "error");
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

  function startEditTable(tbl: Table) {
    setEditingTableId(tbl.id);
    setEditTableForm({
      name: tbl.name,
      minSeats: tbl.minSeats,
      maxSeats: tbl.maxSeats,
      zone: tbl.zone ?? "",
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

  if (isLoading) return <p className="text-gray-500">{t.settings.loading}</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.settings.title}</h2>

      <div className="space-y-6">
        {/* Restaurant details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{t.settings.restaurantDetails}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.name}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.phone}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.address}</label>
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
            {updateMutation.isPending ? t.settings.saving : t.settings.save}
          </button>
        </section>

        {/* Operating hours editor */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{t.settings.operatingHours}</h3>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const h = hours[day];
              const isOpen = h !== null && h !== undefined;
              const dayKey = DAY_KEYS[day] as keyof typeof t.settings.days;
              return (
                <div key={day} className="flex items-center gap-4 text-sm">
                  <span className="w-16 font-medium text-gray-700">{t.settings.days[dayKey]}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={() => toggleDay(day)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className={isOpen ? "text-gray-700" : "text-gray-400"}>
                      {isOpen ? t.settings.open : t.settings.closed}
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
                      <span className="text-gray-400">&mdash;</span>
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
              {updateMutation.isPending ? t.settings.saving : t.settings.saveHours}
            </button>
            {hoursSaved && <span className="text-sm text-green-600">{t.settings.saved}</span>}
          </div>
        </section>

        {/* Tables editor */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t.settings.tables}</h3>
            <button
              onClick={() => setShowAddTable(!showAddTable)}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              {showAddTable ? t.settings.cancel : t.settings.addTable}
            </button>
          </div>

          {/* Add table form */}
          {showAddTable && (
            <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t.settings.tableName}</label>
                  <input
                    type="text"
                    value={tableForm.name}
                    onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                    placeholder="T1"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t.settings.minSeats}</label>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.minSeats}
                    onChange={(e) => setTableForm({ ...tableForm, minSeats: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t.settings.maxSeats}</label>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.maxSeats}
                    onChange={(e) => setTableForm({ ...tableForm, maxSeats: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t.settings.zone}</label>
                  <input
                    type="text"
                    value={tableForm.zone}
                    onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value })}
                    placeholder={t.settings.zonePlaceholder}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleAddTable}
                disabled={createTableMutation.isPending || !tableForm.name.trim()}
                className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {createTableMutation.isPending ? t.settings.saving : t.guestDetail.add}
              </button>
            </div>
          )}

          {!tablesList || tablesList.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.settings.noTables}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tablesList.map((tbl: Table) =>
                editingTableId === tbl.id ? (
                  <div
                    key={tbl.id}
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
                        title={t.settings.minSeats}
                      />
                      <input
                        type="number"
                        min={1}
                        value={editTableForm.maxSeats}
                        onChange={(e) =>
                          setEditTableForm({ ...editTableForm, maxSeats: Number(e.target.value) })
                        }
                        className="w-1/2 px-2 py-1 border border-gray-300 rounded text-sm"
                        title={t.settings.maxSeats}
                      />
                    </div>
                    <input
                      type="text"
                      value={editTableForm.zone}
                      onChange={(e) => setEditTableForm({ ...editTableForm, zone: e.target.value })}
                      placeholder={t.settings.zone}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveTable}
                        disabled={updateTableMutation.isPending}
                        className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        {t.settings.save}
                      </button>
                      <button
                        onClick={() => setEditingTableId(null)}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        {t.settings.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={tbl.id}
                    className="border border-gray-200 rounded-lg p-3 text-center group relative"
                  >
                    <p className="font-medium text-sm">{tbl.name}</p>
                    <p className="text-xs text-gray-500">
                      {tbl.minSeats}–{tbl.maxSeats} {t.settings.seats}
                    </p>
                    {tbl.zone && (
                      <p className="text-xs text-gray-400 mt-1">{tbl.zone}</p>
                    )}
                    <div className="mt-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditTable(tbl)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        {t.settings.edit}
                      </button>
                      <button
                        onClick={() => handleDeleteTable(tbl.id)}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        {t.settings.delete}
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        {/* Dashboard Customization */}
        <DashboardCustomization restaurant={restaurant} updateMutation={updateMutation} />

        {/* Danger Zone */}
        <section className="bg-white rounded-xl border-2 border-red-300 p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-2">{t.settings.dangerZone}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t.settings.dangerDesc}
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              {t.settings.resetReservations}
            </button>
            <span className="text-xs text-gray-400">{t.settings.resetDesc}</span>
          </div>

          {/* Confirmation dialog */}
          {showResetConfirm && (
            <ModalPortal>
              <div
                className="fixed inset-0 z-[100] bg-black/30"
                onClick={() => setShowResetConfirm(false)}
              />
              <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                <div
                  className="w-full max-w-sm rounded-xl border-2 border-red-300 bg-white p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 className="mb-2 text-lg font-semibold text-red-700">{t.settings.resetConfirm}</h4>
                  <p className="mb-4 text-sm text-gray-600">
                    {t.settings.resetConfirmDesc}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleResetReservations}
                      disabled={resetMutation.isPending}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {resetMutation.isPending ? t.settings.resetting : t.settings.resetConfirmBtn}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                    >
                      {t.settings.cancel}
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </section>
      </div>
    </div>
  );
}
