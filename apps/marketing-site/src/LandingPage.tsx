import { useState } from "react";

type Lang = "he" | "en";

const t = {
  he: {
    nav: { product: "המוצר", tools: "כלים", pricing: "מחירון", demo: "דמו" },
    hero: {
      title: "Sable",
      subtitle: "חבר הצוות הכי חכם של המסעדה שלך",
      desc: "מערכת מלאה לניהול מסעדה - הזמנות, CRM אורחים, נאמנות, גיימיפיקציה, קמפיינים ואוטומציה. הכל מונע AI, הכל בוואטסאפ ובאתר שלך.",
      cta1: "ראה מחירים",
      cta2: "בקש דמו",
      trusted: "מופעל ע״י AI - עובד 24/7 בלי הפסקות",
    },
    stats: [
      { value: "24/7", label: "בוט AI פעיל" },
      { value: "30 שנ׳", label: "חיסכון ביום" },
      { value: "0", label: "עמלה לסועד" },
      { value: "3×", label: "חזרת לקוחות" },
    ],
    toolsTitle: "כל הכלים שאתה צריך",
    toolsSubtitle: "כל כלי בנוי לחסוך לך זמן ולהגדיל הכנסות",
    tools: [
      {
        icon: "📅",
        title: "מנוע הזמנות",
        desc: "מערכת הזמנות מלאה עם שיבוץ שולחנות אוטומטי",
        features: [
          "שיבוץ שולחנות חכם - התאמה אוטומטית לפי גודל קבוצה",
          "בדיקת זמינות בזמן אמת לפי שעות פעילות",
          "ניהול שעות פעילות ותאריכים מיוחדים",
          "תזכורות אוטומטיות 3 שעות לפני",
          "ניהול no-show - מעקב ודיווח על אי-הגעות",
          "אישור, הושבה, סיום, ביטול - הכל בלחיצה",
        ],
      },
      {
        icon: "⏳",
        title: "רשימת המתנה",
        desc: "ניהול אוטומטי של רשימת המתנה עם התאמה חכמה",
        features: [
          "הוספה לרשימת המתנה כשאין מקום",
          "התאמה אוטומטית כשמתפנה שולחן (ביטול → הצעה)",
          "הצעת מקום עם ספירה לאחור של 15 דקות",
          "אישור → הפיכה אוטומטית להזמנה",
          "עדיפות לפי סדר הגעה (ראשון שהגיע ← ראשון שמקבל)",
        ],
      },
      {
        icon: "🖥️",
        title: "דשבורד בעלים",
        desc: "מרכז שליטה בזמן אמת לכל מה שקורה במסעדה",
        features: [
          "סקירת יום - הזמנות, סועדים, ביטולים, no-shows",
          "מפת תפוסה לפי שעה (Heatmap)",
          "מפת שולחנות חיה - פנוי / מוזמן / תפוס",
          "יצירת הזמנה מהדשבורד (שיחות טלפון)",
          "סינון לפי תאריך, סטטוס, חיפוש אורח",
          "ניווט מהיר עם חיצים + ספירות בצד",
          "פאנל עריכת הזמנה (slide-over)",
          "עריכת שעות פעילות + ניהול שולחנות",
        ],
      },
      {
        icon: "🔗",
        title: "ווידג׳ט הזמנות לאתר",
        desc: "ווידג׳ט הזמנות שנטען באתר שלך בשורת קוד אחת",
        features: [
          "זמינות בזמן אמת - בחירת תאריך → שעה → פרטים → אישור",
          "עיצוב מותאם - צבע ראשי, לוגו, טקסט קבלת פנים",
          "וולידציית טלפון ישראלי",
          "מובייל-first עם RTL מלא",
          "Bundle קטן (<20KB) - לא מאט את האתר",
          "הטמעה בשורה אחת: <script src=\"...\">",
        ],
      },
      {
        icon: "👤",
        title: "CRM אורחים",
        desc: "פרופיל מלא לכל אורח - הכל במקום אחד",
        features: [
          "יצירה אוטומטית בהזמנה הראשונה",
          "היסטוריית ביקורים מלאה (תאריכים, מנות, דירוגים)",
          "העדפות תזונתיות (צמחוני, טבעוני, אלרגיות, כשרות)",
          "תגיות אוטומטיות: VIP, חוזר, חדש, לקוח בסיכון, מוציא גדול",
          "הערות צוות + שדה אירועים (יום הולדת, עסקי, דייט)",
          "תובנות: מנות אהובות, תדירות ביקור, העדפת יום/שעה",
          "חיפוש לפי שם או טלפון",
        ],
      },
      {
        icon: "📝",
        title: "מעקב ביקורים ופידבק",
        desc: "לדעת מה כל אורח אכל, מה חשב, ומה הוא אוהב",
        features: [
          "לוג ביקור: מנות, הוצאה, דירוג, פידבק, אירוע",
          "פרופיל תזונתי מצטבר מכל הביקורים",
          "ניתוח סנטימנט (חיובי / ניטרלי / שלילי)",
          "דירוג >= 4 → תיוג 'מרוצה' + בקשת ביקורת Google",
          "דירוג <= 2 → תיוג 'בסיכון' + התראה לבעלים",
          "סיכום פידבק למסעדה: ממוצע, חלוקה, תלונות אחרונות",
        ],
      },
      {
        icon: "⭐",
        title: "מנוע נאמנות",
        desc: "נקודות, חותמות, דרגות VIP - הכל אוטומטי",
        features: [
          "10 נקודות לביקור × מכפיל דרגה (ברונזה ×1, כסף ×1.5, זהב ×2)",
          "כרטיס חותמות: כל 10 ביקורים = 50 נקודות בונוס",
          "דרגות VIP אוטומטיות: ברונזה → כסף (5+ ביקורים) → זהב (15+)",
          "קטלוג פרסים - יצירה ומימוש עם קוד ייחודי",
          "היסטוריית עסקאות נקודות",
          "האורח שואל בוואטסאפ: 'מה היתרה שלי?' - הבוט עונה",
        ],
      },
      {
        icon: "🎮",
        title: "גיימיפיקציה",
        desc: "הפוך ביקורים למשחק - תן לאורחים סיבה לחזור",
        features: [
          "מערכת הפניות - קוד ייחודי, 50 נקודות למפנה + 25 לחדש",
          "אתגרים - 'בקר 3 פעמים השבוע' עם פרס בסיום",
          "רצפי ביקורים - בונוס על ביקורים שבועיים רצופים (3, 5, 10, 20)",
          "מעקב התקדמות אוטומטי",
          "מיילסטון בונוסים (נקודות × אורך רצף)",
        ],
      },
      {
        icon: "🤖",
        title: "אוטומציית שיווק",
        desc: "הודעות אוטומטיות שנשלחות בזמן הנכון",
        features: [
          "תודה אחרי ביקור - נשלח 2 שעות אחרי סיום",
          "בקשת ביקורת - 24 שעות אחרי, רק לאורחים עם 3+ ביקורים",
          "יום הולדת - ברכה + 100 נקודות בונוס",
          "Win-back - 30/60/90 יום אחרי ביקור אחרון עם הצעות הולכות וגדלות",
          "כל ההודעות מכבדות שעות שקט (22:00-08:00)",
        ],
      },
      {
        icon: "💬",
        title: "בוט וואטסאפ AI",
        desc: "הזמנות, שאלות, נאמנות - הכל דרך וואטסאפ",
        features: [
          "הזמנת שולחן בשיחה טבעית (בקרוב)",
          "זיהוי שפה אוטומטי - עברית, אנגלית, ערבית",
          "הבוט מכיר את האורח - טוען פרופיל מלא בכל שיחה",
          "בדיקת יתרת נקודות, מימוש פרסים",
          "העברה לבן אדם כשצריך",
          "סיכום יומי לבעלים בוואטסאפ",
        ],
      },
      {
        icon: "🔐",
        title: "אבטחה וגישה",
        desc: "הנתונים שלך מוגנים - גישה רק עם הרשאה",
        features: [
          "JWT Authentication על כל הנתיבים",
          "התחברות עם אימייל וסיסמה",
          "הפרדת נתונים לפי מסעדה",
          "נתיבים ציבוריים: זמינות + הזמנה (לווידג׳ט)",
          "נתיבים מוגנים: דשבורד, אורחים, הגדרות",
        ],
      },
    ],
    howTitle: "איך זה עובד",
    howSteps: [
      { num: "1", title: "אורח מזמין", desc: "דרך וואטסאפ, האתר שלך, או טלפון - ההזמנה מגיעה למערכת" },
      { num: "2", title: "AI מנהל", desc: "שולחן משובץ אוטומטית, אישור נשלח, תזכורת מתוזמנת" },
      { num: "3", title: "אורח מגיע", desc: "הצוות רואה הכל בדשבורד - פרופיל, העדפות, היסטוריה" },
      { num: "4", title: "אחרי הביקור", desc: "נקודות נצברות, תודה נשלחת, ביקורת מתבקשת, והאורח חוזר" },
    ],
    comparisonTitle: "למה Sable ולא המתחרים",
    comparison: {
      headers: ["", "Sable", "Ontopo", "Tabit", "SevenRooms"],
      rows: [
        ["הזמנות אונליין", "v", "v", "v", "v"],
        ["בוט וואטסאפ AI", "v", "x", "x", "x"],
        ["CRM אורחים", "v", "x", "~", "v"],
        ["נאמנות + גיימיפיקציה", "v", "x", "x", "v"],
        ["אוטומציית שיווק", "v", "x", "x", "v"],
        ["ווידג׳ט לאתר", "v", "x", "v", "v"],
        ["ללא עמלה לסועד", "v", "v", "x", "x"],
        ["מחיר", "מ-₪499", "חינם", "₪800+", "$500+"],
      ],
    },
    launch: {
      title: "מבצע השקה - 5 מסעדות ראשונות",
      desc: "מערכת הזמנות מלאה ב-₪299 חד-פעמי. ללא מנוי חודשי. רק 5 מקומות.",
      cta: "רוצה מקום? דבר איתנו",
      note: "אחרי ההשקה: מנוי חודשי מ-₪499/חודש",
    },
    pricing: {
      title: "מחירון",
      subtitle: "לפי מספר מושבים. ללא עמלה לסועד. 14 ימי ניסיון חינם.",
      starter: {
        name: "Starter",
        desc: "הזמנות + ווידג׳ט + דשבורד",
        includes: ["מנוע הזמנות מלא", "ווידג׳ט לאתר", "דשבורד בעלים", "רשימת המתנה", "תזכורות אוטומטיות", "ניהול שעות + שולחנות", "מעקב no-show"],
      },
      standard: {
        name: "Standard",
        desc: "הכל ב-Starter + נאמנות + CRM + אוטומציה",
        includes: ["הכל ב-Starter", "CRM אורחים מלא", "מנוע נאמנות (נקודות + חותמות + VIP)", "מעקב ביקורים + פידבק + סנטימנט", "גיימיפיקציה (הפניות + אתגרים + רצפים)", "אוטומציית שיווק (תודה, יום הולדת, win-back)", "תיוג אוטומטי של אורחים"],
      },
      annual: "הנחה שנתית: שלם 10 חודשים, קבל 12.",
    },
    addons: {
      title: "תוספות",
      items: [
        { name: "בוט וואטסאפ AI", price: "₪149/חודש", desc: "בוט AI שמנהל שיחות + הזמנות בוואטסאפ" },
        { name: "קמפיינים ושיווק", price: "₪99/חודש", desc: "סגמנטציה, תבניות, שליחה מתוזמנת" },
        { name: "גיימיפיקציה מתקדמת", price: "₪79/חודש", desc: "אתגרים, גלגל מזל, לידרבורד, בונוסים" },
        { name: "אנליטיקס ודוחות", price: "₪59/חודש", desc: "שימור, CLV, ROI קמפיינים, מפת חום" },
      ],
    },
    cta: {
      title: "רוצה לנסות?",
      desc: "14 ימי ניסיון חינם. בלי כרטיס אשראי. בלי התחייבות.",
      button: "דבר איתנו",
    },
    faq: {
      title: "שאלות נפוצות",
      items: [
        { q: "האם צריך ידע טכני?", a: "לא. הווידג׳ט מוטמע בשורת קוד אחת, הדשבורד עובד מהדפדפן, ווואטסאפ עובד לבד." },
        { q: "מה קורה אחרי תקופת הניסיון?", a: "בוחרים חבילה ומתחילים לשלם. אין הפתעות, אין עמלות נסתרות." },
        { q: "האם יש עמלה לסועד?", a: "לא. אף פעם. מנוי חודשי קבוע לפי מספר מושבים." },
        { q: "באילו שפות הבוט עובד?", a: "עברית, אנגלית, וערבית. זיהוי שפה אוטומטי." },
        { q: "אפשר לנסות לפני שמשלמים?", a: "כן! 14 ימי ניסיון חינם, בלי כרטיס אשראי." },
      ],
    },
  },
  en: {
    nav: { product: "Product", tools: "Tools", pricing: "Pricing", demo: "Demo" },
    hero: {
      title: "Sable",
      subtitle: "Your restaurant's smartest team member",
      desc: "Complete restaurant management - reservations, guest CRM, loyalty, gamification, campaigns & automation. All AI-powered, via WhatsApp and your website.",
      cta1: "See pricing",
      cta2: "Request demo",
      trusted: "Powered by AI - works 24/7 without breaks",
    },
    stats: [
      { value: "24/7", label: "AI Bot Active" },
      { value: "30 min", label: "Saved Daily" },
      { value: "0", label: "Per-Cover Fee" },
      { value: "3×", label: "Guest Return Rate" },
    ],
    toolsTitle: "Every tool you need",
    toolsSubtitle: "Each tool is built to save you time and increase revenue",
    tools: [
      {
        icon: "📅",
        title: "Reservation Engine",
        desc: "Full reservation system with automatic table assignment",
        features: [
          "Smart table assignment - auto-fit by party size",
          "Real-time availability based on operating hours",
          "Operating hours & special dates management",
          "Automatic reminders 3 hours before",
          "No-show tracking & reporting",
          "Confirm, seat, complete, cancel - one click",
        ],
      },
      {
        icon: "⏳",
        title: "Waitlist",
        desc: "Automatic waitlist management with smart matching",
        features: [
          "Add to waitlist when fully booked",
          "Auto-match when a table opens (cancellation → offer)",
          "15-minute countdown to accept offered slot",
          "Accept → auto-converts to reservation",
          "First-come-first-served priority",
        ],
      },
      {
        icon: "🖥️",
        title: "Owner Dashboard",
        desc: "Real-time control center for everything happening in your restaurant",
        features: [
          "Today view - reservations, covers, cancellations, no-shows",
          "Hourly occupancy heatmap",
          "Live table map - available / reserved / occupied",
          "Create reservations from dashboard (phone calls)",
          "Filter by date, status, guest search",
          "Quick navigation with arrows + sidebar counts",
          "Reservation edit panel (slide-over)",
          "Operating hours & table management",
        ],
      },
      {
        icon: "🔗",
        title: "Website Booking Widget",
        desc: "Embeddable booking widget - one line of code on your website",
        features: [
          "Real-time availability - date → time → details → confirm",
          "Custom branding - primary color, logo, welcome text",
          "Israeli phone validation",
          "Mobile-first with full RTL support",
          "Tiny bundle (<20KB) - won't slow your site",
          "One-line embed: <script src=\"...\">",
        ],
      },
      {
        icon: "👤",
        title: "Guest CRM",
        desc: "Full profile for every guest - everything in one place",
        features: [
          "Auto-created on first booking",
          "Full visit history (dates, dishes, ratings)",
          "Dietary preferences (vegetarian, vegan, allergies, kosher level)",
          "Auto-tags: VIP, returning, new, at-risk, big spender",
          "Staff notes + occasion field (birthday, business, date night)",
          "Insights: favorite dishes, visit frequency, day/time preference",
          "Search by name or phone",
        ],
      },
      {
        icon: "📝",
        title: "Visit Tracking & Feedback",
        desc: "Know what every guest ate, what they thought, and what they love",
        features: [
          "Visit log: dishes, spend, rating, feedback, occasion",
          "Aggregated dietary profile from all visits",
          "Sentiment analysis (positive / neutral / negative)",
          "Rating >= 4 → tagged 'happy' + Google Review prompt",
          "Rating <= 2 → tagged 'at-risk' + owner alert",
          "Restaurant feedback summary: average, distribution, recent complaints",
        ],
      },
      {
        icon: "⭐",
        title: "Loyalty Engine",
        desc: "Points, stamps, VIP tiers - all automatic",
        features: [
          "10 points per visit × tier multiplier (bronze ×1, silver ×1.5, gold ×2)",
          "Stamp card: every 10 visits = 50 bonus points",
          "Auto VIP tiers: bronze → silver (5+ visits) → gold (15+)",
          "Reward catalog - create & redeem with unique code",
          "Point transaction history",
          "Guest asks on WhatsApp: 'What's my balance?' - bot answers",
        ],
      },
      {
        icon: "🎮",
        title: "Gamification",
        desc: "Turn visits into a game - give guests a reason to come back",
        features: [
          "Referral system - unique code, 50 points to referrer + 25 to new guest",
          "Challenges - 'Visit 3 times this week' with reward on completion",
          "Visit streaks - bonus for consecutive weekly visits (3, 5, 10, 20)",
          "Automatic progress tracking",
          "Milestone bonuses (points × streak length)",
        ],
      },
      {
        icon: "🤖",
        title: "Marketing Automation",
        desc: "Automatic messages sent at the right time",
        features: [
          "Post-visit thank you - sent 2 hours after completion",
          "Review request - 24 hours after, only for 3+ visit guests",
          "Birthday greeting - auto-greeting + 100 bonus points",
          "Win-back - 30/60/90 days after last visit with escalating offers",
          "All messages respect quiet hours (22:00-08:00)",
        ],
      },
      {
        icon: "💬",
        title: "WhatsApp AI Bot",
        desc: "Reservations, questions, loyalty - all via WhatsApp",
        features: [
          "Book a table in natural conversation (coming soon)",
          "Auto language detection - Hebrew, English, Arabic",
          "Bot knows the guest - loads full profile every conversation",
          "Check point balance, redeem rewards",
          "Handoff to human when needed",
          "Daily summary to owner via WhatsApp",
        ],
      },
      {
        icon: "🔐",
        title: "Security & Access",
        desc: "Your data is protected - access only with authorization",
        features: [
          "JWT Authentication on all routes",
          "Email + password login",
          "Data isolation per restaurant",
          "Public routes: availability + booking (for widget)",
          "Protected routes: dashboard, guests, settings",
        ],
      },
    ],
    howTitle: "How it works",
    howSteps: [
      { num: "1", title: "Guest books", desc: "Via WhatsApp, your website, or phone - the booking enters the system" },
      { num: "2", title: "AI manages", desc: "Table assigned automatically, confirmation sent, reminder scheduled" },
      { num: "3", title: "Guest arrives", desc: "Staff sees everything on dashboard - profile, preferences, history" },
      { num: "4", title: "After the visit", desc: "Points earned, thank-you sent, review requested, and the guest comes back" },
    ],
    comparisonTitle: "Why Sable over the competition",
    comparison: {
      headers: ["", "Sable", "Ontopo", "Tabit", "SevenRooms"],
      rows: [
        ["Online reservations", "v", "v", "v", "v"],
        ["WhatsApp AI Bot", "v", "x", "x", "x"],
        ["Guest CRM", "v", "x", "~", "v"],
        ["Loyalty + Gamification", "v", "x", "x", "v"],
        ["Marketing Automation", "v", "x", "x", "v"],
        ["Website Widget", "v", "x", "v", "v"],
        ["No per-cover fee", "v", "v", "x", "x"],
        ["Price", "from ₪499", "Free", "₪800+", "$500+"],
      ],
    },
    launch: {
      title: "Launch Offer - First 5 Restaurants",
      desc: "Full reservation system for ₪299 one-time. No monthly subscription. Only 5 spots.",
      cta: "Want a spot? Talk to us",
      note: "After launch: monthly plans from ₪499/mo",
    },
    pricing: {
      title: "Pricing",
      subtitle: "By seat count. No per-cover fees. 14-day free trial.",
      starter: {
        name: "Starter",
        desc: "Reservations + Widget + Dashboard",
        includes: ["Full reservation engine", "Website booking widget", "Owner dashboard", "Waitlist", "Automatic reminders", "Hours & table management", "No-show tracking"],
      },
      standard: {
        name: "Standard",
        desc: "Everything in Starter + Loyalty + CRM + Automation",
        includes: ["Everything in Starter", "Full guest CRM", "Loyalty engine (points + stamps + VIP)", "Visit tracking + feedback + sentiment", "Gamification (referrals + challenges + streaks)", "Marketing automation (thank-you, birthday, win-back)", "Auto guest tagging"],
      },
      annual: "Annual discount: pay 10 months, get 12.",
    },
    addons: {
      title: "Add-ons",
      items: [
        { name: "WhatsApp AI Bot", price: "₪149/mo", desc: "AI bot for WhatsApp conversations + bookings" },
        { name: "Campaigns & Marketing", price: "₪99/mo", desc: "Segmentation, templates, scheduled sends" },
        { name: "Advanced Gamification", price: "₪79/mo", desc: "Challenges, lucky spin, leaderboard, bonuses" },
        { name: "Analytics & Reports", price: "₪59/mo", desc: "Retention, CLV, campaign ROI, heatmaps" },
      ],
    },
    cta: {
      title: "Ready to try?",
      desc: "14-day free trial. No credit card. No commitment.",
      button: "Talk to us",
    },
    faq: {
      title: "FAQ",
      items: [
        { q: "Do I need technical knowledge?", a: "No. The widget embeds in one line, the dashboard runs in your browser, and WhatsApp works on its own." },
        { q: "What happens after the trial?", a: "Choose a plan and start paying. No surprises, no hidden fees." },
        { q: "Is there a per-cover fee?", a: "No. Never. Fixed monthly subscription by seat count." },
        { q: "What languages does the bot support?", a: "Hebrew, English, and Arabic. Auto language detection." },
        { q: "Can I try before paying?", a: "Yes! 14-day free trial, no credit card required." },
      ],
    },
  },
};

const starterTiers = [
  { tier: "S", seats: 40, price: 499 },
  { tier: "M", seats: 80, price: 699 },
  { tier: "L", seats: 150, price: 999 },
  { tier: "XL", seats: -1, price: 1399 },
];

const standardTiers = [
  { tier: "S", seats: 40, price: 799 },
  { tier: "M", seats: 80, price: 1099 },
  { tier: "L", seats: 150, price: 1499 },
  { tier: "XL", seats: -1, price: 1999 },
];

function sl(seats: number, lang: Lang) {
  return seats === -1 ? "150+" : lang === "he" ? `עד ${seats}` : `Up to ${seats}`;
}

function ComparisonCell({ v }: { v: string }) {
  if (v === "v") return <span className="text-green-600 font-bold text-lg">&#10003;</span>;
  if (v === "x") return <span className="text-red-400">&#10007;</span>;
  if (v === "~") return <span className="text-yellow-500">~</span>;
  return <span className="text-sm font-medium">{v}</span>;
}

export function LandingPage() {
  const [lang, setLang] = useState<Lang>("he");
  const c = t[lang];
  const dir = lang === "he" ? "rtl" : "ltr";
  const su = lang === "he" ? "מושבים" : "seats";
  const pm = lang === "he" ? "/חודש" : "/mo";

  return (
    <div dir={dir} className="min-h-screen bg-white text-gray-900" style={{ direction: dir }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <span className="text-xl font-bold">Sable</span>
        <div className="flex items-center gap-6 text-sm">
          <a href="#tools" className="text-gray-600 hover:text-gray-900 hidden md:inline">{c.nav.tools}</a>
          <a href="#pricing" className="text-gray-600 hover:text-gray-900 hidden md:inline">{c.nav.pricing}</a>
          <a href="#demo" className="text-gray-600 hover:text-gray-900 hidden md:inline">{c.nav.demo}</a>
          <button onClick={() => setLang(lang === "he" ? "en" : "he")} className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            {lang === "he" ? "EN" : "עב"}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="bg-gradient-to-b from-amber-50 to-white px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">{c.hero.title}</h1>
        <p className="text-2xl md:text-3xl text-gray-700 mt-3 font-medium">{c.hero.subtitle}</p>
        <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto">{c.hero.desc}</p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <a href="#pricing" className="px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition">{c.hero.cta1}</a>
          <a href="#demo" className="px-6 py-3 border-2 border-amber-600 text-amber-700 rounded-xl font-semibold hover:bg-amber-50 transition">{c.hero.cta2}</a>
        </div>
        <p className="text-sm text-gray-400 mt-6">{c.hero.trusted}</p>
      </header>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gray-50 px-6 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {c.stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-amber-600">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section id="tools" className="px-6 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">{c.toolsTitle}</h2>
        <p className="text-center text-gray-500 mb-12">{c.toolsSubtitle}</p>
        <div className="grid md:grid-cols-2 gap-6">
          {c.tools.map((tool) => (
            <div key={tool.title} className="border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{tool.icon}</span>
                <div>
                  <h3 className="text-lg font-bold">{tool.title}</h3>
                  <p className="text-sm text-gray-500">{tool.desc}</p>
                </div>
              </div>
              <ul className="space-y-1.5 mt-3">
                {tool.features.map((f, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-amber-500 mt-0.5 shrink-0">&#9679;</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-12">{c.howTitle}</h2>
        <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-8">
          {c.howSteps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-12 h-12 bg-amber-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">{step.num}</div>
              <h3 className="font-bold mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">{c.comparisonTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {c.comparison.headers.map((h, i) => (
                  <th key={i} className={`px-4 py-3 font-semibold ${i === 1 ? "text-amber-700 bg-amber-50" : "text-gray-600"} ${i === 0 ? "text-start" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.comparison.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-gray-100">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3 ${ci === 0 ? "text-start font-medium" : "text-center"} ${ci === 1 ? "bg-amber-50/50" : ""}`}>
                      {ci === 0 ? cell : <ComparisonCell v={cell} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Launch Offer */}
      <section className="px-6 py-16 bg-red-50 border-y-2 border-red-200">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{c.launch.title}</h2>
          <p className="text-xl text-gray-700 mb-6">{c.launch.desc}</p>
          <a href="mailto:sione@kaspa.com" className="inline-block px-8 py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition">{c.launch.cta}</a>
          <p className="text-sm text-gray-500 mt-4">{c.launch.note}</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-4">{c.pricing.title}</h2>
        <p className="text-center text-gray-500 mb-12">{c.pricing.subtitle}</p>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Starter */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h3 className="text-2xl font-bold mb-1">{c.pricing.starter.name}</h3>
            <p className="text-gray-500 text-sm mb-4">{c.pricing.starter.desc}</p>
            <ul className="space-y-2 mb-6">
              {c.pricing.starter.includes.map((f) => (
                <li key={f} className="text-sm flex gap-2"><span className="text-green-500">&#10003;</span>{f}</li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-gray-100 pt-4">
              {starterTiers.map((tier) => (
                <div key={tier.tier} className="flex justify-between text-sm">
                  <span>{sl(tier.seats, lang)} {su}</span>
                  <span className="font-bold">&#8362;{tier.price}{pm}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Standard */}
          <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-600 text-white text-xs font-bold rounded-full">
              {lang === "he" ? "הכי פופולרי" : "Most popular"}
            </div>
            <h3 className="text-2xl font-bold mb-1">{c.pricing.standard.name}</h3>
            <p className="text-gray-500 text-sm mb-4">{c.pricing.standard.desc}</p>
            <ul className="space-y-2 mb-6">
              {c.pricing.standard.includes.map((f) => (
                <li key={f} className="text-sm flex gap-2"><span className="text-green-500">&#10003;</span>{f}</li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-amber-200 pt-4">
              {standardTiers.map((tier) => (
                <div key={tier.tier} className="flex justify-between text-sm">
                  <span>{sl(tier.seats, lang)} {su}</span>
                  <span className="font-bold">&#8362;{tier.price}{pm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-gray-400 mt-8">{c.pricing.annual}</p>
      </section>

      {/* Add-ons */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">{c.addons.title}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {c.addons.items.map((a) => (
            <div key={a.name} className="border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold">{a.name}</span>
                <span className="font-bold text-amber-700 text-sm">{a.price}</span>
              </div>
              <p className="text-sm text-gray-500">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 bg-gray-50">
        <h2 className="text-2xl font-bold text-center mb-8">{c.faq.title}</h2>
        <div className="max-w-3xl mx-auto space-y-4">
          {c.faq.items.map((item) => (
            <details key={item.q} className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
                {item.q}
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl">+</span>
              </summary>
              <p className="text-sm text-gray-600 mt-3">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="demo" className="px-6 py-20 text-center bg-gradient-to-b from-white to-amber-50">
        <h2 className="text-3xl font-bold mb-4">{c.cta.title}</h2>
        <p className="text-gray-600 mb-8">{c.cta.desc}</p>
        <a href="mailto:sione@kaspa.com" className="px-8 py-4 bg-amber-600 text-white rounded-xl font-semibold text-lg hover:bg-amber-700 transition">{c.cta.button}</a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        Sable &copy; 2026 KaspaCom
      </footer>
    </div>
  );
}
