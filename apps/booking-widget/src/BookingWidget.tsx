import { useState } from "preact/hooks";

interface Props {
  restaurantId: string;
  apiUrl?: string;
}

type Step = "date" | "time" | "details" | "confirm";

export function BookingWidget({ restaurantId, apiUrl }: Props) {
  const [step, setStep] = useState<Step>("date");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async () => {
    const baseUrl =
      apiUrl ||
      import.meta.env.VITE_WIDGET_API_URL ||
      window.location.origin;
    // TODO: POST to API, handle response
    setStep("confirm");
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 400, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>הזמנת שולחן</h2>

      {step === "date" && (
        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>תאריך</label>
          <input
            type="date"
            value={date}
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
          <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>שעות פנויות ל-{date}</p>
          {/* TODO: fetch available slots from API and display */}
          <p style={{ color: "#999", fontSize: 13 }}>טוען שעות פנויות...</p>
          <button onClick={() => setStep("date")} style={{ marginTop: 16, fontSize: 13, color: "#666", background: "none", border: "none", cursor: "pointer" }}>
            ← חזרה
          </button>
        </div>
      )}

      {step === "details" && (
        <div>
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
            disabled={!name || !phone}
            style={{ marginTop: 16, width: "100%", padding: 12, background: "#d97706", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            אישור הזמנה
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 32 }}>✅</p>
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
