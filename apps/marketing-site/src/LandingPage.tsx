const starterTiers = [
  { tier: "S", seats: "עד 40", priceIL: "₪99", priceUS: "$29" },
  { tier: "M", seats: "עד 80", priceIL: "₪149", priceUS: "$39" },
  { tier: "L", seats: "עד 150", priceIL: "₪249", priceUS: "$69" },
  { tier: "XL", seats: "150+", priceIL: "₪399", priceUS: "$109" },
];

const growthTiers = [
  { tier: "S", seats: "עד 40", priceIL: "₪299", priceUS: "$79" },
  { tier: "M", seats: "עד 80", priceIL: "₪449", priceUS: "$119" },
  { tier: "L", seats: "עד 150", priceIL: "₪649", priceUS: "$179" },
  { tier: "XL", seats: "150+", priceIL: "₪899", priceUS: "$249" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <header className="bg-gradient-to-b from-amber-50 to-white px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Sable</h1>
        <p className="text-xl text-gray-600 mt-4 max-w-2xl mx-auto">
          חבר הצוות הכי חכם של המסעדה שלך. הזמנות, CRM, נאמנות וגיימיפיקציה — הכל ב-AI, הכל בוואטסאפ.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a href="#pricing" className="px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition">
            ראה מחירים
          </a>
          <a href="#demo" className="px-6 py-3 border-2 border-amber-600 text-amber-700 rounded-xl font-semibold hover:bg-amber-50 transition">
            בקש דמו
          </a>
        </div>
      </header>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">מה Sable עושה בשבילך</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "📅", title: "הזמנות חכמות", desc: "בוט AI שמנהל הזמנות בוואטסאפ + ווידג׳ט לאתר. שיבוץ שולחנות אוטומטי, תזכורות, רשימת המתנה." },
            { icon: "👤", title: "CRM אורחים", desc: "פרופיל לכל אורח — היסטוריית ביקורים, העדפות, תגיות. תדע מי מגיע לפני שהם נכנסים." },
            { icon: "🏆", title: "נאמנות וגיימיפיקציה", desc: "כרטיסי חותמות, נקודות, דרגות VIP, אתגרים, גלגל מזל, הפניות. תן לאורחים סיבה לחזור." },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-4">מחירון</h2>
        <p className="text-center text-gray-500 mb-12">לפי מספר מושבים. ללא עמלה לסועד. 14 ימי ניסיון חינם.</p>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Starter */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h3 className="text-xl font-bold mb-1">Starter</h3>
            <p className="text-gray-500 text-sm mb-6">הזמנות + בוט AI</p>
            <div className="space-y-3">
              {starterTiers.map((t) => (
                <div key={t.tier} className="flex justify-between text-sm">
                  <span>{t.seats} מושבים</span>
                  <span className="font-semibold">{t.priceIL}/חודש</span>
                </div>
              ))}
            </div>
          </div>

          {/* Growth */}
          <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-8">
            <h3 className="text-xl font-bold mb-1">Growth</h3>
            <p className="text-gray-500 text-sm mb-6">CRM + נאמנות + גיימיפיקציה + קמפיינים</p>
            <div className="space-y-3">
              {growthTiers.map((t) => (
                <div key={t.tier} className="flex justify-between text-sm">
                  <span>{t.seats} מושבים</span>
                  <span className="font-semibold">{t.priceIL}/חודש</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">הנחה שנתית: שלם 10 חודשים, קבל 12.</p>
      </section>

      {/* CTA */}
      <section id="demo" className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">רוצה לנסות?</h2>
        <p className="text-gray-600 mb-8">14 ימי ניסיון חינם. בלי כרטיס אשראי. בלי התחייבות.</p>
        <a href="mailto:sione@kaspa.com" className="px-8 py-4 bg-amber-600 text-white rounded-xl font-semibold text-lg hover:bg-amber-700 transition">
          דבר איתנו
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        Sable &copy; 2026 KaspaCom
      </footer>
    </div>
  );
}
