import { useState } from "react";

type Lang = "he" | "en";

const content = {
  he: {
    hero: {
      title: "Sable",
      subtitle: "חבר הצוות הכי חכם של המסעדה שלך",
      desc: "מערכת הזמנות חכמה, CRM אורחים, נאמנות וגיימיפיקציה — הכל ב-AI, הכל בוואטסאפ ובאתר שלך.",
      cta1: "ראה מחירים",
      cta2: "בקש דמו",
    },
    features: {
      title: "מה אנחנו עושים בשבילך",
      items: [
        { icon: "📅", title: "הזמנות חכמות", desc: "בוט AI שמנהל הזמנות בוואטסאפ + ווידג׳ט לאתר. שיבוץ שולחנות אוטומטי, תזכורות, רשימת המתנה, ניהול no-show." },
        { icon: "👤", title: "CRM אורחים", desc: "פרופיל לכל אורח — היסטוריית ביקורים, העדפות, תגיות. תכיר את האורחים שלך לפני שהם נכנסים." },
        { icon: "🏆", title: "נאמנות וגיימיפיקציה", desc: "כרטיסי חותמות, נקודות, דרגות VIP, אתגרים, הפניות. תן לאורחים סיבה לחזור." },
        { icon: "📊", title: "דשבורד בזמן אמת", desc: "סקירת יום, תפוסה לפי שעה, ניהול הזמנות, פרופילי אורחים — הכל במקום אחד." },
        { icon: "💬", title: "וואטסאפ + אתר", desc: "אורחים מזמינים דרך וואטסאפ או ווידג׳ט באתר שלך. שפה עברית, אנגלית, ערבית." },
        { icon: "📈", title: "קמפיינים ואוטומציה", desc: "הודעת תודה, בקשת ביקורת, יום הולדת, win-back — הכל אוטומטי." },
      ],
    },
    launch: {
      title: "🔥 מבצע השקה — 5 מסעדות ראשונות",
      desc: "מערכת הזמנות מלאה ב-₪299 חד-פעמי. ללא מנוי חודשי. רק 5 מקומות.",
      cta: "רוצה מקום? דבר איתנו",
      note: "אחרי ההשקה: מנוי חודשי מ-₪499/חודש",
    },
    pricing: {
      title: "מחירון",
      subtitle: "לפי מספר מושבים. ללא עמלה לסועד. 14 ימי ניסיון חינם.",
      starter: { name: "Starter", desc: "הזמנות + ווידג׳ט + דשבורד" },
      standard: { name: "Standard", desc: "הכל ב-Starter + נאמנות + CRM + אוטומציה" },
      annual: "הנחה שנתית: שלם 10 חודשים, קבל 12.",
    },
    addons: {
      title: "תוספות",
      items: [
        { name: "בוט וואטסאפ AI", price: "₪149/חודש" },
        { name: "קמפיינים ושיווק", price: "₪99/חודש" },
        { name: "גיימיפיקציה מתקדמת", price: "₪79/חודש" },
        { name: "אנליטיקס ודוחות", price: "₪59/חודש" },
      ],
    },
    cta: {
      title: "רוצה לנסות?",
      desc: "14 ימי ניסיון חינם. בלי כרטיס אשראי. בלי התחייבות.",
      button: "דבר איתנו",
    },
  },
  en: {
    hero: {
      title: "Sable",
      subtitle: "Your restaurant's smartest team member",
      desc: "Smart reservations, guest CRM, loyalty & gamification — all AI-powered, via WhatsApp and your website.",
      cta1: "See pricing",
      cta2: "Request demo",
    },
    features: {
      title: "What we do for you",
      items: [
        { icon: "📅", title: "Smart Reservations", desc: "AI-powered reservation bot via WhatsApp + embeddable website widget. Auto table assignment, reminders, waitlist, no-show tracking." },
        { icon: "👤", title: "Guest CRM", desc: "Full guest profiles — visit history, preferences, tags. Know your guests before they walk in." },
        { icon: "🏆", title: "Loyalty & Gamification", desc: "Stamp cards, points, VIP tiers, challenges, referrals. Give guests a reason to come back." },
        { icon: "📊", title: "Real-time Dashboard", desc: "Today overview, hourly occupancy, reservation management, guest profiles — all in one place." },
        { icon: "💬", title: "WhatsApp + Web", desc: "Guests book via WhatsApp or your website widget. Hebrew, English, Arabic support." },
        { icon: "📈", title: "Campaigns & Automation", desc: "Thank-you messages, review requests, birthday offers, win-back — all automated." },
      ],
    },
    launch: {
      title: "🔥 Launch Offer — First 5 Restaurants",
      desc: "Full reservation system for ₪299 one-time. No monthly subscription. Only 5 spots.",
      cta: "Want a spot? Talk to us",
      note: "After launch: monthly plans from ₪499/mo",
    },
    pricing: {
      title: "Pricing",
      subtitle: "By seat count. No per-cover fees. 14-day free trial.",
      starter: { name: "Starter", desc: "Reservations + Widget + Dashboard" },
      standard: { name: "Standard", desc: "Everything in Starter + Loyalty + CRM + Automation" },
      annual: "Annual discount: pay 10 months, get 12.",
    },
    addons: {
      title: "Add-ons",
      items: [
        { name: "WhatsApp AI Bot", price: "₪149/mo" },
        { name: "Campaigns & Marketing", price: "₪99/mo" },
        { name: "Advanced Gamification", price: "₪79/mo" },
        { name: "Analytics & Reports", price: "₪59/mo" },
      ],
    },
    cta: {
      title: "Ready to try?",
      desc: "14-day free trial. No credit card. No commitment.",
      button: "Talk to us",
    },
  },
};

const starterTiers = [
  { tier: "S", seats: 40, priceIL: 499 },
  { tier: "M", seats: 80, priceIL: 699 },
  { tier: "L", seats: 150, priceIL: 999 },
  { tier: "XL", seats: -1, priceIL: 1399 },
];

const standardTiers = [
  { tier: "S", seats: 40, priceIL: 799 },
  { tier: "M", seats: 80, priceIL: 1099 },
  { tier: "L", seats: 150, priceIL: 1499 },
  { tier: "XL", seats: -1, priceIL: 1999 },
];

function seatLabel(seats: number, lang: Lang) {
  if (seats === -1) return "150+";
  return lang === "he" ? `עד ${seats}` : `Up to ${seats}`;
}

function seatsUnit(lang: Lang) {
  return lang === "he" ? "מושבים" : "seats";
}

function perMonth(lang: Lang) {
  return lang === "he" ? "/חודש" : "/mo";
}

export function LandingPage() {
  const [lang, setLang] = useState<Lang>("he");
  const t = content[lang];
  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <div dir={dir} className="min-h-screen bg-white text-gray-900" style={{ direction: dir }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-xl font-bold">Sable</span>
        <button
          onClick={() => setLang(lang === "he" ? "en" : "he")}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          {lang === "he" ? "EN" : "עב"}
        </button>
      </nav>

      {/* Hero */}
      <header className="bg-gradient-to-b from-amber-50 to-white px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">{t.hero.title}</h1>
        <p className="text-2xl text-gray-700 mt-3 font-medium">{t.hero.subtitle}</p>
        <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto">{t.hero.desc}</p>
        <div className="mt-8 flex gap-4 justify-center">
          <a href="#pricing" className="px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition">
            {t.hero.cta1}
          </a>
          <a href="#demo" className="px-6 py-3 border-2 border-amber-600 text-amber-700 rounded-xl font-semibold hover:bg-amber-50 transition">
            {t.hero.cta2}
          </a>
        </div>
      </header>

      {/* Features */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">{t.features.title}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {t.features.items.map((f) => (
            <div key={f.title} className="text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Launch Offer */}
      <section className="px-6 py-16 bg-red-50 border-y-2 border-red-200">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t.launch.title}</h2>
          <p className="text-xl text-gray-700 mb-6">{t.launch.desc}</p>
          <a href="mailto:sione@kaspa.com" className="inline-block px-8 py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition">
            {t.launch.cta}
          </a>
          <p className="text-sm text-gray-500 mt-4">{t.launch.note}</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-4">{t.pricing.title}</h2>
        <p className="text-center text-gray-500 mb-12">{t.pricing.subtitle}</p>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Starter */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h3 className="text-xl font-bold mb-1">{t.pricing.starter.name}</h3>
            <p className="text-gray-500 text-sm mb-6">{t.pricing.starter.desc}</p>
            <div className="space-y-3">
              {starterTiers.map((tier) => (
                <div key={tier.tier} className="flex justify-between text-sm">
                  <span>{seatLabel(tier.seats, lang)} {seatsUnit(lang)}</span>
                  <span className="font-semibold">₪{tier.priceIL}{perMonth(lang)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Standard */}
          <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-600 text-white text-xs font-bold rounded-full">
              {lang === "he" ? "הכי פופולרי" : "Most popular"}
            </div>
            <h3 className="text-xl font-bold mb-1">{t.pricing.standard.name}</h3>
            <p className="text-gray-500 text-sm mb-6">{t.pricing.standard.desc}</p>
            <div className="space-y-3">
              {standardTiers.map((tier) => (
                <div key={tier.tier} className="flex justify-between text-sm">
                  <span>{seatLabel(tier.seats, lang)} {seatsUnit(lang)}</span>
                  <span className="font-semibold">₪{tier.priceIL}{perMonth(lang)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">{t.pricing.annual}</p>
      </section>

      {/* Add-ons */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">{t.addons.title}</h2>
        <div className="grid grid-cols-2 gap-4">
          {t.addons.items.map((addon) => (
            <div key={addon.name} className="flex justify-between items-center border border-gray-200 rounded-xl p-4">
              <span className="text-sm font-medium">{addon.name}</span>
              <span className="text-sm font-bold text-amber-700">{addon.price}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="demo" className="px-6 py-20 text-center bg-gradient-to-b from-white to-amber-50">
        <h2 className="text-3xl font-bold mb-4">{t.cta.title}</h2>
        <p className="text-gray-600 mb-8">{t.cta.desc}</p>
        <a href="mailto:sione@kaspa.com" className="px-8 py-4 bg-amber-600 text-white rounded-xl font-semibold text-lg hover:bg-amber-700 transition">
          {t.cta.button}
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        Sable &copy; 2026 KaspaCom
      </footer>
    </div>
  );
}
