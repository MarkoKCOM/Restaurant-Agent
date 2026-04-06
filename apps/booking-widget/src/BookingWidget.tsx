import { useState, useEffect } from "preact/hooks";

interface Props {
  restaurantId: string;
  apiUrl?: string;
}

interface AvailabilitySlot {
  time: string;
  availableTables: number;
  maxPartySize: number;
}

interface WidgetConfig {
  primaryColor?: string;
  logo?: string;
  welcomeText?: string;
}

type Step = "date" | "time" | "preferences" | "details" | "confirm";
type Seating = "indoor" | "outdoor" | "bar";

function isValidIsraeliPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+972")) return /^\+972\d{8,9}$/.test(digits);
  if (digits.startsWith("0")) return /^0\d{9}$/.test(digits);
  return false;
}

const seatingIcons: Record<Seating, string> = { indoor: "🏠", outdoor: "🌿", bar: "🍷" };
const seatingLabels: Record<Seating, string> = { indoor: "בפנים", outdoor: "בחוץ", bar: "בר" };
const allergyOptions = ["אגוזים", "חלב", "גלוטן", "פירות ים", "ביצים", "סויה"];

export function BookingWidget({ restaurantId, apiUrl }: Props) {
  const [step, setStep] = useState<Step>("date");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [seating, setSeating] = useState<Seating>("indoor");
  const [smoking, setSmoking] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({});

  const baseUrl =
    apiUrl ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WIDGET_API_URL) ||
    window.location.origin;

  const accent = widgetConfig.primaryColor || "#d97706";
  const accentHover = "#b45309";
  const accentLight = "#fffbeb";
  const headerText = widgetConfig.welcomeText || "הזמנת שולחן";

  const steps: Step[] = ["date", "time", "preferences", "details", "confirm"];
  const currentIdx = steps.indexOf(step);

  useEffect(() => {
    fetch(`${baseUrl}/api/v1/restaurants/${restaurantId}`)
      .then((res) => res.json())
      .then((data) => { if (data.widgetConfig) setWidgetConfig(data.widgetConfig as WidgetConfig); })
      .catch(() => {});
  }, [restaurantId, baseUrl]);

  useEffect(() => {
    if (step !== "time" || !date) return;
    setLoadingSlots(true);
    setError("");
    const params = new URLSearchParams({ restaurantId, date, partySize: String(partySize) });
    fetch(`${baseUrl}/api/v1/reservations/availability?${params}`)
      .then((res) => res.json())
      .then((data) => { setSlots(data.slots || []); setLoadingSlots(false); })
      .catch(() => { setError("שגיאה בטעינת השעות"); setLoadingSlots(false); });
  }, [step, date, partySize, restaurantId, baseUrl]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/api/v1/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, guestName: name, guestPhone: phone, date, timeStart: time, partySize, source: "web", seating, smoking, allergies, specialRequests }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "שגיאה ביצירת ההזמנה"); }
      setStep("confirm");
    } catch (e: any) { setError(e.message || "שגיאה ביצירת ההזמנה"); }
    finally { setSubmitting(false); }
  };

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const s = {
    wrapper: { fontFamily: "'Rubik', 'Inter', system-ui, sans-serif", maxWidth: 420, margin: "0 auto", borderRadius: 20, overflow: "hidden" as const, boxShadow: "0 20px 60px rgba(0,0,0,0.12)", border: "1px solid #f0f0f0" },
    header: { background: `linear-gradient(135deg, ${accent}, ${accentHover})`, padding: "20px 24px 16px", display: "flex", alignItems: "center", gap: 12 },
    headerIcon: { fontSize: 28 },
    headerTitle: { fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 },
    headerSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 },
    progress: { display: "flex", gap: 6, padding: "16px 24px 8px" },
    progressBar: (active: boolean) => ({ flex: 1, height: 5, borderRadius: 4, background: active ? accent : "#e5e7eb", transition: "background 0.3s" }),
    body: { padding: "0 24px 24px" },
    error: { padding: 10, marginBottom: 12, borderRadius: 12, background: "#fef2f2", color: "#b91c1c", fontSize: 13 },
    label: { display: "block" as const, fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 },
    input: { width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" as const },
    btn: (disabled?: boolean) => ({ width: "100%", padding: 14, borderRadius: 12, border: "none", background: disabled ? "#9ca3af" : accent, color: "#fff", fontWeight: 600, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer", marginTop: 12, transition: "background 0.2s" }),
    backBtn: { marginTop: 8, fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", display: "block" as const },
    counter: { display: "flex", alignItems: "center", gap: 16 },
    counterBtn: { width: 40, height: 40, borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 18, fontWeight: 700, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
    counterVal: { fontSize: 24, fontWeight: 700, color: accent },
    seatingGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
    seatingCard: (selected: boolean) => ({ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 12, border: `2px solid ${selected ? accent : "#e5e7eb"}`, background: selected ? accentLight : "#fff", color: selected ? accent : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }),
    smokingGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    smokingCard: (selected: boolean) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 8px", borderRadius: 12, border: `2px solid ${selected ? accent : "#e5e7eb"}`, background: selected ? accentLight : "#fff", color: selected ? accent : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }),
    chipWrap: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
    chip: (selected: boolean, warn?: boolean) => ({ padding: "6px 14px", borderRadius: 20, border: `1px solid ${selected ? (warn ? "#ef4444" : accent) : "#e5e7eb"}`, background: selected ? (warn ? "#fef2f2" : accentLight) : "#fff", color: selected ? (warn ? "#dc2626" : accent) : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }),
    summary: { display: "flex", flexWrap: "wrap" as const, gap: 8, padding: "10px 14px", borderRadius: 12, background: "#f9fafb", fontSize: 12, color: "#6b7280", marginBottom: 12 },
  };

  return (
    <div style={s.wrapper} dir="rtl">
      {/* Header */}
      <div style={s.header}>
        {widgetConfig.logo
          ? <img src={widgetConfig.logo} alt="" style={{ height: 32, width: 32, objectFit: "contain", borderRadius: 6 }} />
          : <span style={s.headerIcon}>🍽️</span>}
        <div>
          <p style={s.headerTitle}>{headerText}</p>
          <p style={s.headerSub}>BFF Ra'anana</p>
        </div>
      </div>

      {/* Progress */}
      <div style={s.progress}>
        {steps.slice(0, -1).map((_, i) => <div key={i} style={s.progressBar(i <= currentIdx)} />)}
      </div>

      <div style={s.body}>
        {error && <div style={s.error}>{error}</div>}

        {/* Step 1: Date & Party Size */}
        {step === "date" && (
          <div>
            <label style={s.label}>תאריך</label>
            <input type="date" value={date} min={new Date().toISOString().slice(0, 10)}
              onInput={(e) => setDate((e.target as HTMLInputElement).value)} style={s.input} />
            <label style={{ ...s.label, marginTop: 16 }}>מספר סועדים</label>
            <div style={s.counter}>
              <button style={s.counterBtn} onClick={() => setPartySize(Math.max(1, partySize - 1))}>-</button>
              <span style={s.counterVal}>{partySize}</span>
              <button style={s.counterBtn} onClick={() => setPartySize(Math.min(20, partySize + 1))}>+</button>
              <span style={{ fontSize: 14, color: "#9ca3af" }}>👤</span>
            </div>
            <button onClick={() => date && setStep("time")} disabled={!date} style={s.btn(!date)}>המשך →</button>
          </div>
        )}

        {/* Step 2: Time */}
        {step === "time" && (
          <div>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>שעות פנויות ל-{date} ({partySize} סועדים)</p>
            {loadingSlots ? (
              <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 24 }}>טוען שעות פנויות...</p>
            ) : slots.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 24 }}>אין שעות פנויות לתאריך זה</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {slots.map((slot) => {
                  const sel = time === slot.time;
                  return (
                    <button key={slot.time} onClick={() => { setTime(slot.time); setStep("preferences"); }}
                      style={{ padding: "10px 4px", borderRadius: 12, border: `2px solid ${sel ? accent : "#e5e7eb"}`, background: sel ? accent : "#fff", color: sel ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}>
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setStep("date")} style={s.backBtn}>← חזרה</button>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === "preferences" && (
          <div>
            <label style={s.label}>איזור ישיבה</label>
            <div style={s.seatingGrid}>
              {(["indoor", "outdoor", "bar"] as Seating[]).map((seat) => (
                <button key={seat} onClick={() => setSeating(seat)} style={s.seatingCard(seating === seat)}>
                  <span style={{ fontSize: 22 }}>{seatingIcons[seat]}</span>
                  {seatingLabels[seat]}
                </button>
              ))}
            </div>

            <label style={{ ...s.label, marginTop: 16 }}>עישון</label>
            <div style={s.smokingGrid}>
              <button onClick={() => setSmoking(false)} style={s.smokingCard(!smoking)}>🚭 ללא עישון</button>
              <button onClick={() => setSmoking(true)} style={s.smokingCard(smoking)}>🚬 אזור עישון</button>
            </div>

            <label style={{ ...s.label, marginTop: 16 }}>אלרגיות</label>
            <div style={s.chipWrap}>
              <button onClick={() => setAllergies([])} style={s.chip(allergies.length === 0)}>ללא</button>
              {allergyOptions.map((a) => {
                const sel = allergies.includes(a);
                return <button key={a} onClick={() => toggleAllergy(a)} style={s.chip(sel, true)}>{sel ? "⚠️ " : ""}{a}</button>;
              })}
            </div>

            <button onClick={() => setStep("details")} style={s.btn()}>המשך →</button>
            <button onClick={() => setStep("time")} style={s.backBtn}>← חזרה</button>
          </div>
        )}

        {/* Step 4: Details */}
        {step === "details" && (
          <div>
            <div style={s.summary}>
              <span>📅 {date}</span>
              <span>🕐 {time}</span>
              <span>👤 {partySize}</span>
              <span>{seatingIcons[seating]} {seatingLabels[seating]}</span>
              {smoking && <span>🚬</span>}
              {allergies.length > 0 && <span>⚠️ {allergies.join(", ")}</span>}
            </div>
            <label style={s.label}>שם</label>
            <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} style={s.input} />
            <label style={{ ...s.label, marginTop: 12 }}>טלפון</label>
            <input type="tel" value={phone}
              onInput={(e) => { const val = (e.target as HTMLInputElement).value; setPhone(val); if (phoneError) setPhoneError(""); }}
              onBlur={() => { if (phone && !isValidIsraeliPhone(phone)) setPhoneError("מספר טלפון לא תקין"); }}
              style={{ ...s.input, borderColor: phoneError ? "#b91c1c" : "#e5e7eb" }} />
            {phoneError && <p style={{ color: "#b91c1c", fontSize: 12, margin: "4px 0 0" }}>{phoneError}</p>}
            <label style={{ ...s.label, marginTop: 12 }}>בקשות מיוחדות</label>
            <textarea value={specialRequests} onInput={(e) => setSpecialRequests((e.target as HTMLTextAreaElement).value)}
              placeholder="כסא תינוק, יום הולדת, וכו׳..."
              rows={2} style={{ ...s.input, resize: "none" as const }} />
            <button
              onClick={() => { if (!isValidIsraeliPhone(phone)) { setPhoneError("מספר טלפון לא תקין"); return; } handleSubmit(); }}
              disabled={!name || !phone || submitting}
              style={s.btn(!name || !phone || submitting)}>
              {submitting ? "שולח..." : "אישור הזמנה"}
            </button>
            <button onClick={() => setStep("preferences")} style={s.backBtn}>← חזרה</button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === "confirm" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <span style={{ fontSize: 28 }}>✅</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ההזמנה התקבלה!</p>
            <p style={{ fontSize: 14, color: "#4b5563" }}>{date} בשעה {time}</p>
            <p style={{ fontSize: 14, color: "#4b5563" }}>{partySize} סועדים - {seatingLabels[seating]}</p>
            {allergies.length > 0 && <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>⚠️ {allergies.join(", ")}</p>}
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>💬 אישור יישלח אליך בוואטסאפ</p>
          </div>
        )}
      </div>
    </div>
  );
}
