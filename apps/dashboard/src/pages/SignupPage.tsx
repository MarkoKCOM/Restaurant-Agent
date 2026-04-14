import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  selfServeSignupOwnerSchema,
  selfServeSignupRestaurantSchema,
  selfServeSignupTablesSchema,
  type OperatingHoursInput,
  type SelfServeSignupInput,
  type SelfServeSignupTableInput,
} from "@openseat/domain";
import { useAuth } from "../hooks/useAuth.js";
import { useLang } from "../i18n.js";

const STEPS = ["owner", "restaurant", "hours", "tables"] as const;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type DayKey = (typeof DAY_KEYS)[number];
type StepKey = (typeof STEPS)[number];

const DEFAULT_HOURS: OperatingHoursInput = {
  sun: { open: "17:00", close: "23:00" },
  mon: { open: "17:00", close: "23:00" },
  tue: { open: "17:00", close: "23:00" },
  wed: { open: "17:00", close: "23:00" },
  thu: { open: "17:00", close: "23:00" },
  fri: { open: "12:00", close: "15:00" },
  sat: null,
};

const EMPTY_TABLE: SelfServeSignupTableInput = {
  name: "T1",
  minSeats: 2,
  maxSeats: 4,
  zone: "main",
};

const DAY_LABELS: Record<DayKey, { he: string; en: string }> = {
  sun: { he: "ראשון", en: "Sunday" },
  mon: { he: "שני", en: "Monday" },
  tue: { he: "שלישי", en: "Tuesday" },
  wed: { he: "רביעי", en: "Wednesday" },
  thu: { he: "חמישי", en: "Thursday" },
  fri: { he: "שישי", en: "Friday" },
  sat: { he: "שבת", en: "Saturday" },
};

function getFirstIssueMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "issues" in error && Array.isArray(error.issues)) {
    const firstIssue = error.issues[0];
    if (
      typeof firstIssue === "object"
      && firstIssue !== null
      && "message" in firstIssue
      && typeof firstIssue.message === "string"
    ) {
      return firstIssue.message;
    }
  }

  return fallback;
}

export function SignupPage() {
  const { signup, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  const [step, setStep] = useState(0);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pkg, setPkg] = useState<"starter" | "growth">("starter");
  const [locale, setLocale] = useState<"he" | "en">("he");
  const [timezone, setTimezone] = useState("Asia/Jerusalem");
  const [operatingHours, setOperatingHours] = useState<OperatingHoursInput>(DEFAULT_HOURS);
  const [tables, setTables] = useState<SelfServeSignupTableInput[]>([EMPTY_TABLE]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeStep = STEPS[step] as StepKey;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    navigate(role === "super_admin" ? "/restaurants" : "/today", { replace: true });
  }, [isAuthenticated, navigate, role]);

  function buildSignupPayload(): SelfServeSignupInput {
    return {
      owner: {
        name: ownerName,
        email: ownerEmail,
        password,
      },
      restaurant: {
        name: restaurantName,
        cuisineType,
        phone,
        address,
        package: pkg,
        locale,
        timezone,
        operatingHours,
      },
      tables,
    };
  }

  function validateOwnerStep(): string | null {
    const result = selfServeSignupOwnerSchema.safeParse({
      name: ownerName,
      email: ownerEmail,
      password,
    });

    if (!result.success) {
      return getFirstIssueMessage(result.error, t.signup.validation.owner);
    }

    if (password !== confirmPassword) {
      return t.signup.validation.passwordMismatch;
    }

    return null;
  }

  function validateRestaurantStep(): string | null {
    const result = selfServeSignupRestaurantSchema.safeParse({
      name: restaurantName,
      cuisineType,
      phone,
      address,
      package: pkg,
      locale,
      timezone,
      operatingHours,
    });

    if (!result.success) {
      return getFirstIssueMessage(result.error, t.signup.validation.restaurant);
    }

    return null;
  }

  function validateHoursStep(): string | null {
    const result = selfServeSignupRestaurantSchema.safeParse({
      name: restaurantName,
      cuisineType,
      phone,
      address,
      package: pkg,
      locale,
      timezone,
      operatingHours,
    });

    if (!result.success) {
      return getFirstIssueMessage(result.error, t.signup.validation.hours);
    }

    return null;
  }

  function validateTablesStep(): string | null {
    const result = selfServeSignupTablesSchema.safeParse(tables);
    if (!result.success) {
      return getFirstIssueMessage(result.error, t.signup.validation.tables);
    }

    return null;
  }

  function validateCurrentStep(): string | null {
    if (activeStep === "owner") return validateOwnerStep();
    if (activeStep === "restaurant") return validateRestaurantStep();
    if (activeStep === "hours") return validateHoursStep();
    return validateTablesStep();
  }

  function handleNext() {
    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }

    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function handlePrevious() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  function toggleDay(dayKey: DayKey) {
    setOperatingHours((current) => ({
      ...current,
      [dayKey]: current[dayKey] ? null : (DEFAULT_HOURS[dayKey] ?? { open: "17:00", close: "23:00" }),
    }));
  }

  function updateDayHours(dayKey: DayKey, field: "open" | "close", value: string) {
    setOperatingHours((current) => {
      const dayHours = current[dayKey] ?? { open: "17:00", close: "23:00" };
      return {
        ...current,
        [dayKey]: {
          ...dayHours,
          [field]: value,
        },
      };
    });
  }

  function updateTable(index: number, field: keyof SelfServeSignupTableInput, value: string | number) {
    setTables((current) => current.map((table, tableIndex) => {
      if (tableIndex !== index) {
        return table;
      }

      return {
        ...table,
        [field]: value,
      };
    }));
  }

  function addTable() {
    setTables((current) => [
      ...current,
      {
        name: `T${current.length + 1}`,
        minSeats: 2,
        maxSeats: 4,
        zone: "main",
      },
    ]);
  }

  function removeTable(index: number) {
    setTables((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((_, tableIndex) => tableIndex !== index);
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signup(buildSignupPayload());
      navigate("/today", { replace: true });
    } catch (signupError: unknown) {
      setError(signupError instanceof Error ? signupError.message : t.signup.validation.submit);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir={lang === "he" ? "rtl" : "ltr"}
      className="min-h-screen bg-gray-50 py-8 px-4"
    >
      <button
        type="button"
        onClick={() => setLang(lang === "he" ? "en" : "he")}
        className="fixed top-4 right-4 px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {lang === "he" ? "EN" : "עב"}
      </button>

      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-amber-600 mb-2">OpenSeat</p>
                <h1 className="text-3xl font-bold text-gray-900">{t.signup.title}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.signup.subtitle}</p>
              </div>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-amber-700"
              >
                {t.signup.backToLogin}
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 mb-8">
              {STEPS.map((stepKey, index) => {
                const isActive = index === step;
                const isComplete = index < step;
                return (
                  <div
                    key={stepKey}
                    className={`rounded-xl border px-3 py-3 text-sm ${
                      isActive
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    <div className="font-semibold">{index + 1}. {t.signup.steps[stepKey]}</div>
                  </div>
                );
              })}
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {activeStep === "owner" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.ownerName}</label>
                    <input
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.ownerEmail}</label>
                    <input
                      type="email"
                      dir="ltr"
                      value={ownerEmail}
                      onChange={(event) => setOwnerEmail(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.password}</label>
                    <input
                      type="password"
                      dir="ltr"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.confirmPassword}</label>
                    <input
                      type="password"
                      dir="ltr"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activeStep === "restaurant" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.restaurantName}</label>
                    <input
                      value={restaurantName}
                      onChange={(event) => setRestaurantName(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.cuisineType}</label>
                    <input
                      value={cuisineType}
                      onChange={(event) => setCuisineType(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.phone}</label>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.address}</label>
                    <textarea
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.package}</label>
                    <select
                      value={pkg}
                      onChange={(event) => setPkg(event.target.value as "starter" | "growth")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="starter">{t.signup.packages.starter}</option>
                      <option value="growth">{t.signup.packages.growth}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.locale}</label>
                    <select
                      value={locale}
                      onChange={(event) => setLocale(event.target.value as "he" | "en")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="he">{t.signup.locales.he}</option>
                      <option value="en">{t.signup.locales.en}</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.timezone}</label>
                    <input
                      dir="ltr"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {activeStep === "hours" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">{t.signup.hoursHelp}</p>
                  {DAY_KEYS.map((dayKey) => {
                    const dayHours = operatingHours[dayKey];
                    return (
                      <div key={dayKey} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{DAY_LABELS[dayKey][lang]}</p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={!!dayHours}
                              onChange={() => toggleDay(dayKey)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <span>{dayHours ? t.signup.dayOpen : t.signup.dayClosed}</span>
                          </label>
                        </div>

                        {dayHours ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.opensAt}</label>
                              <input
                                type="time"
                                value={dayHours.open}
                                onChange={(event) => updateDayHours(dayKey, "open", event.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.closesAt}</label>
                              <input
                                type="time"
                                value={dayHours.close}
                                onChange={(event) => updateDayHours(dayKey, "close", event.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {activeStep === "tables" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">{t.signup.tablesHelp}</p>
                  {tables.map((table, index) => (
                    <div key={`${table.name}-${index}`} className="rounded-xl border border-gray-200 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-gray-900">{t.signup.tableLabel} {index + 1}</h3>
                        <button
                          type="button"
                          onClick={() => removeTable(index)}
                          disabled={tables.length === 1}
                          className="text-sm font-medium text-red-600 disabled:text-gray-300"
                        >
                          {t.signup.removeTable}
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.tableName}</label>
                          <input
                            value={table.name}
                            onChange={(event) => updateTable(index, "name", event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.minSeats}</label>
                          <input
                            type="number"
                            min={1}
                            value={table.minSeats}
                            onChange={(event) => updateTable(index, "minSeats", Number(event.target.value))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.maxSeats}</label>
                          <input
                            type="number"
                            min={1}
                            value={table.maxSeats}
                            onChange={(event) => updateTable(index, "maxSeats", Number(event.target.value))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.signup.zone}</label>
                          <input
                            value={table.zone ?? ""}
                            onChange={(event) => updateTable(index, "zone", event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTable}
                    className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
                  >
                    {t.signup.addTable}
                  </button>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 0}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
                >
                  {t.signup.previous}
                </button>

                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    {t.signup.next}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {loading ? t.signup.submitting : t.signup.submit}
                  </button>
                )}
              </div>
            </form>
          </div>

          <aside className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-fit">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.signup.reviewTitle}</h2>
            <div className="space-y-5 text-sm text-gray-600">
              <section>
                <p className="font-semibold text-gray-900 mb-1">{t.signup.steps.owner}</p>
                <p>{ownerName || t.signup.emptyState}</p>
                <p dir="ltr">{ownerEmail || t.signup.emptyState}</p>
              </section>
              <section>
                <p className="font-semibold text-gray-900 mb-1">{t.signup.steps.restaurant}</p>
                <p>{restaurantName || t.signup.emptyState}</p>
                <p>{cuisineType || t.signup.emptyState}</p>
                <p>{address || t.signup.emptyState}</p>
                <p>{pkg === "starter" ? t.signup.packages.starter : t.signup.packages.growth}</p>
              </section>
              <section>
                <p className="font-semibold text-gray-900 mb-1">{t.signup.steps.hours}</p>
                <div className="space-y-1">
                  {DAY_KEYS.map((dayKey) => {
                    const dayHours = operatingHours[dayKey];
                    return (
                      <p key={dayKey}>
                        <span className="font-medium text-gray-800">{DAY_LABELS[dayKey][lang]}:</span>{" "}
                        {dayHours ? `${dayHours.open} - ${dayHours.close}` : t.signup.dayClosed}
                      </p>
                    );
                  })}
                </div>
              </section>
              <section>
                <p className="font-semibold text-gray-900 mb-1">{t.signup.steps.tables}</p>
                <div className="space-y-2">
                  {tables.map((table, index) => (
                    <p key={`${table.name}-summary-${index}`}>
                      <span className="font-medium text-gray-800">{table.name || `${t.signup.tableLabel} ${index + 1}`}</span>
                      {`: ${table.minSeats}-${table.maxSeats} ${t.signup.seatsSummary}`}
                      {table.zone ? ` · ${table.zone}` : ""}
                    </p>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
