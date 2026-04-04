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

type Step = "date" | "time" | "details" | "confirm";

export function BookingWidget({ restaurantId, apiUrl }: Props) {
  const [step, setStep] = useState<Step>("date");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const baseUrl =
    apiUrl ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WIDGET_API_URL) ||
    window.location.origin;

  // Fetch availability when entering the time step
  useEffect(() => {
    if (step !== "time" || !date) return;
    setLoadingSlots(true);
    setError("");

    const params = new URLSearchParams({
      restaurantId,
      date,
      partySize: String(partySize),
    });

    fetch(`${baseUrl}/api/v1/reservations/availability?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoadingSlots(false);
      })
      .catch(() => {
        setError("שגיאה בטעינת השעות");
        setLoadingSlots(false);
      });
  }, [step, date, partySize, restaurantId, baseUrl]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${baseUrl}/api/v1/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          guestName: name,
          guestPhone: phone,
          date,
          timeStart: time,
          partySize,
          source: "web",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "שגיאה ביצירת ההזמנה");
      }

      setStep("confirm");
    } catch (e: any) {
      setError(e.message || "שגיאה ביצירת ההזמנה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 400, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>הזמנת שולחן</h2>

      {error && (
        <div style={{ padding: 8, marginBottom: 12, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      {step === "date" && (
        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>תאריך</label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onInput={(e) => setDate((e.target as HTMLInputElement).value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <label style={{ display: "block", marginTop: 16, marginBottom: 8, fontSize: 14 }}>מספר סועדים</label>
          <select
            value={partySize}
            onInput={(e) => setPartySize(Number((e.target as HTMLSelectElement).value))}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={() => date && setStep("time")}
            style={{ marginTop: 16, width: "100%", padding: 12, background: "#d97706", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            המשך
          </button>
        </div>
      )}

      {step === "time" && (
        <div>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>שעות פנויות ל-{date} ({partySize} סועדים)</p>
          {loadingSlots ? (
            <p style={{ color: "#999", fontSize: 13 }}>טוען שעות פנויות...</p>
          ) : slots.length === 0 ? (
            <p style={{ color: "#999", fontSize: 13 }}>אין שעות פנויות לתאריך זה</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => {
                    setTime(slot.time);
                    setStep("details");
                  }}
                  style={{
                    padding: "10px 4px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: time === slot.time ? "#d97706" : "#fff",
                    color: time === slot.time ? "#fff" : "#374151",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setStep("date")}
            style={{ marginTop: 16, fontSize: 13, color: "#666", background: "none", border: "none", cursor: "pointer" }}
          >
            &larr; חזרה
          </button>
        </div>
      )}

      {step === "details" && (
        <div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            {date} | {time} | {partySize} סועדים
          </p>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>שם</label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16 }}
          />
          <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>טלפון</label>
          <input
            type="tel"
            value={phone}
            onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button
            onClick={handleSubmit}
            disabled={!name || !phone || submitting}
            style={{
              marginTop: 16,
              width: "100%",
              padding: 12,
              background: submitting ? "#9ca3af" : "#d97706",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "שולח..." : "אישור הזמנה"}
          </button>
          <button
            onClick={() => setStep("time")}
            style={{ marginTop: 8, fontSize: 13, color: "#666", background: "none", border: "none", cursor: "pointer", display: "block" }}
          >
            &larr; חזרה
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 32 }}>&#x2705;</p>
          <p style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>ההזמנה התקבלה!</p>
          <p style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
            {date} בשעה {time} | {partySize} סועדים
          </p>
          <p style={{ fontSize: 13, color: "#999", marginTop: 8 }}>אישור יישלח אליך בוואטסאפ</p>
        </div>
      )}
    </div>
  );
}
