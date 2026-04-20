import { useState, useEffect, type FormEvent } from "react";

type Lang = "he" | "en" | "ar";

interface Module {
  icon: string;
  name: string;
  tagline: string;
  desc: string;
  features: string[];
}

/* ── Brand Palette (Red) ── */
const pal = {
  accent: "#C41E3A",
  accentHover: "#A01830",
  accentLight: "#FEF2F2",
  accentLighter: "#FEE2E2",
  accentBorder: "#F87171",
  accentText: "#991B1B",
  stat: "#C41E3A",
  mint: "#C41E3A",
  gradientStart: "#FEF2F2",
  launchBg: "#FFF7ED",
  launchBorder: "#FDBA74",
  launchAccent: "#C41E3A",
  launchHover: "#A01830",
  popularBadge: "#C41E3A",
  compHighlight: "rgba(196,30,58,0.05)",
  compHeader: "#FEF2F2",
  bullet: "#F87171",
  iconBg: "#FEE2E2",
  shadow: "rgba(196,30,58,0.2)",
  inputFocus: "#C41E3A",
  secondaryHover: "rgba(254,242,242,0.8)",
};

const t = {
  he: {
    nav: { modules: "מודולים", pricing: "מחירון", demo: "דמו חי", contact: "צור קשר" },
    hero: {
      title: "OpenSeat",
      subtitle: "חבר הצוות הכי חכם של המסעדה שלך",
      desc: "הזמנות אונליין + מועדון חברים בוואטסאפ. OpenSeat מרכז הזמנות, קשר עם אורחים ודשבורד לבעלים במערכת אחת שעובדת באתר שלך ועל כל טאבלט.",
      cta1: "ראה מחירים",
      cta2: "ראה דמו חי",
      trusted: "מופעל ע״י AI - עובד 24/7 בלי הפסקות",
    },
    stats: [
      { value: "24/7", label: "AI פעיל" },
      { value: "1-2 שעות", label: "חיסכון יומי" },
      { value: "וואטסאפ + אתר", label: "עובד איפה שהאורחים כבר נמצאים" },
      { value: "3×", label: "יותר אורחים חוזרים" },
    ],
    modulesTitle: "שלושה מודולים. מערכת שלמה.",
    modulesSubtitle: "מתחילים בהזמנות ובמועדון חברים. CRM אורחים, וואטסאפ ודשבורד יושבים באותה מערכת.",
    modules: [
      {
        icon: "🟢",
        name: "OpenSeat Live",
        tagline: "מנוע ההזמנות",
        desc: "שיבוץ שולחנות חכם, רשימת המתנה, דשבורד בעלים, ווידג׳ט לאתר - הכל בזמן אמת ועל כל טאבלט.",
        features: [
          "שיבוץ שולחנות אוטומטי לפי גודל קבוצה",
          "בדיקת זמינות בזמן אמת לפי שעות פעילות",
          "ניהול שעות פעילות ותאריכים מיוחדים",
          "רשימת המתנה אוטומטית עם התאמה חכמה",
          "הצעת מקום עם ספירה לאחור של 15 דקות",
          "דשבורד בעלים עם תמונת מצב יומית ומפת תפוסה",
          "יצירת הזמנה מהדשבורד לשיחות טלפון",
          "ווידג׳ט הזמנות לאתר - מובייל-first, RTL, שורת קוד אחת",
          "תזכורות אוטומטיות לפני ההגעה",
          "מעקב no-show ודיווח על אי-הגעות",
        ],
      },
      {
        icon: "🔵",
        name: "OpenSeat Connect",
        tagline: "קשר עם האורחים",
        desc: "CRM אורחים, זיהוי לקוחות חוזרים, בוט וואטסאפ AI ונראות לבעלים - כדי לנהל קשר טוב יותר בלי עוד אפליקציה.",
        features: [
          "CRM אורחים - פרופיל מלא שנוצר אוטומטית מהזמנה ראשונה",
          "היסטוריית ביקורים מלאה עם העדפות והערות לצוות",
          "העדפות תזונתיות, אלרגיות ואירועים מיוחדים",
          "תגיות אוטומטיות: VIP, חוזר, חדש, בסיכון, מארח שולחנות גדולים",
          "ניתוח סנטימנט והבנה מי דורש תשומת לב",
          "תודה אוטומטית אחרי ביקור",
          "בקשת ביקורת רק כשזה מרגיש נכון",
          "ברכות יום הולדת וחגיגות עם הטבה רלוונטית",
          "הודעות חזרה לאורחים שלא ביקרו הרבה זמן",
          "בוט וואטסאפ AI - הזמנות, שאלות, סטטוס חבר מועדון בשיחה טבעית",
          "זיהוי שפה אוטומטי - עברית, אנגלית, ערבית",
          "סיכום יומי לבעלים בוואטסאפ",
        ],
      },
      {
        icon: "🟣",
        name: "OpenSeat Club",
        tagline: "מועדון החברים של המסעדה",
        desc: "נקודות, הטבות, דרגות VIP והפניות - מועדון חברים שנותן לאורחים סיבה אמיתית לחזור שוב ושוב.",
        features: [
          "נקודות על ביקורים והזמנות לפי הכללים של המסעדה",
          "דרגות VIP אוטומטיות לפי תדירות והיקף ביקורים",
          "קטלוג הטבות עם מימוש פשוט לצוות",
          "הטבות יום הולדת, אירועים מיוחדים וביקורי milestone",
          "הפניות חבר מביא חבר עם תגמול לשני הצדדים",
          "האורח בודק יתרה וסטטוס בוואטסאפ ומקבל תשובה מיידית",
          "המארח רואה מי חבר מועדון, מי VIP ומי קרוב להטבה הבאה",
          "הופך ביקור חד-פעמי לקשר ארוך טווח עם המסעדה",
        ],
      },
    ] as Module[],
    howTitle: "איך זה עובד",
    howSteps: [
      { num: "1", title: "הזמנה נכנסת", desc: "האורח מזמין דרך וואטסאפ, האתר שלך או הטלפון - והכל נכנס למקום אחד" },
      { num: "2", title: "OpenSeat מאשר", desc: "המערכת משבצת שולחן, שולחת אישור ומסדרת לצוות יום הרבה יותר רגוע" },
      { num: "3", title: "מזהים את האורח", desc: "הצוות רואה אם זה אורח חוזר, חבר מועדון, VIP ומה חשוב לדעת לפני ההושבה" },
      { num: "4", title: "מחזירים אותו שוב", desc: "אחרי הביקור יוצאות נקודות, הטבה או הודעת חזרה - והקשר עם האורח ממשיך" },
    ],
    whyTitle: "למה OpenSeat",
    whyPoints: [
      { icon: "⏰", title: "חוסך 1-2 שעות ביום", desc: "פחות טלפונים, פחות הקלדות ידניות, פחות בלגן בין וואטסאפ, אתר ודף נייר." },
      { icon: "🤝", title: "משפר את הקשר עם האורחים", desc: "כל ההיסטוריה, ההעדפות והרגעים החשובים של האורח במקום אחד - בלי לנחש." },
      { icon: "📈", title: "מגדיל שימור וחזרות", desc: "מועדון חברים, הטבות ותקשורת נכונה גורמים ליותר אורחים לחזור שוב." },
      { icon: "💬", title: "וואטסאפ + כל טאבלט", desc: "האורחים נשארים בוואטסאפ. הצוות עובד מכל טאבלט או דפדפן שכבר יש במסעדה." },
      { icon: "🎨", title: "White-label + הדשבורד שלך", desc: "מיתוג משלך, ווידג׳ט משלך ודשבורד בעלים משלך - בלי להיראות כמו עוד פלטפורמה גנרית." },
      { icon: "₪", title: "מחיר חודשי נגיש", desc: "מחיר ברור שמתאים למסעדות עצמאיות - בלי חומרה יקרה ובלי עלויות שמנפחות את העסק." },
    ],
    comparisonTitle: "השוואה",
    comparison: {
      headers: ["", "OpenSeat", "Ontopo", "Tabit", "SevenRooms"],
      rows: [
        ["הזמנות אונליין", "v", "v", "v", "v"],
        ["בוט וואטסאפ AI", "v", "x", "x", "x"],
        ["CRM אורחים", "v", "x", "~", "v"],
        ["מועדון חברים", "v", "x", "x", "~"],
        ["ווידג׳ט לאתר", "v", "x", "v", "v"],
        ["דשבורד בעלים", "v", "~", "v", "v"],
        ["מיתוג משלך", "v", "x", "~", "~"],
        ["בעלות על הנתונים", "v", "x", "~", "~"],
        ["מחיר רגיל", "מ-₪499", "חינם", "₪800+", "$500+"],
      ],
    },
    launch: {
      title: "מחיר השקה לפיילוט - 5 מסעדות ראשונות",
      desc: "חבילת Growth המלאה ב-₪299 לחודש ל-5 המסעדות הראשונות. זה מחיר חודשי קבוע לפיילוט, לא תשלום חד-פעמי.",
      cta: "דברו איתנו",
      note: "אחרי 5 המקומות הראשונים חוזרים למחירון Growth הרגיל.",
    },
    pricing: {
      title: "מחירון",
      subtitle: "חבילות חודשיות לפי גודל המסעדה. 14 ימי ניסיון חינם.",
    },
    plans: [
      {
        name: "Live",
        desc: "הזמנות + ווידג׳ט + דשבורד",
        module: "OpenSeat Live",
        tiers: [
          { seats: "עד 40", price: 499 },
          { seats: "עד 80", price: 699 },
          { seats: "עד 150", price: 999 },
          { seats: "150+", price: 1399 },
        ],
      },
      {
        name: "Growth",
        desc: "Live + Connect + Club - הזמנות, CRM ומועדון חברים",
        module: "OpenSeat Live + Connect + Club",
        popular: true,
        tiers: [
          { seats: "עד 40", price: 799 },
          { seats: "עד 80", price: 1099 },
          { seats: "עד 150", price: 1499 },
          { seats: "150+", price: 1999 },
        ],
      },
    ],
    annual: "הנחה שנתית: שלם 10 חודשים, קבל 12.",
    addons: {
      title: "תוספות בהמשך",
      items: [
        { name: "ניהול עובדים והדרכות", price: "בהמשך", desc: "משמרות, הרשאות, תדריכים והכשרת צוות במקום אחד" },
        { name: "ניהול ספקים", price: "בהמשך", desc: "ספקים, הזמנות רכש ותיאום תפעולי מהדשבורד" },
        { name: "ניהול מלאי", price: "בהמשך", desc: "מלאי, חוסרים ותזכורות לפי קצב העבודה של המטבח והבר" },
      ],
    },
    faq: {
      title: "שאלות נפוצות",
      items: [
        { q: "האם צריך ידע טכני?", a: "לא. הווידג׳ט מוטמע בשורת קוד אחת, הדשבורד עובד מהדפדפן, ווואטסאפ עובד לבד." },
        { q: "מה קורה אחרי תקופת הניסיון?", a: "בוחרים חבילה ומתחילים לשלם. בלי הפתעות ובלי אותיות קטנות." },
        { q: "זה עובד על הטאבלט שכבר יש לי?", a: "כן. כל המערכת מבוססת דפדפן ועובדת על כל טאבלט או מחשב רגיל." },
        { q: "אפשר לשים את המיתוג של המסעדה שלי?", a: "כן. הווידג׳ט, הדשבורד והחוויה נבנים סביב המותג שלך." },
        { q: "באילו שפות המערכת עובדת?", a: "עברית, אנגלית וערבית. זיהוי שפה אוטומטי לאורח." },
        { q: "הנתונים שלי באמת שלי?", a: "כן. אתה הבעלים של כל נתוני האורחים וה-CRM שלך." },
      ],
    },
    demoTitle: "דמו הזמנה חי",
    demoSubtitle: "כך נראה תהליך ההזמנה באתר שלך - מהיר, נקי ועובד על כל טאבלט.",
    widget: {
      title: "הזמנת שולחן",
      restaurant: "BFF Ra'anana",
      dateLabel: "תאריך",
      partySizeLabel: "מספר סועדים",
      continue: "המשך",
      slotsFor: "שעות פנויות ל-",
      diners: "סועדים",
      loadingSlots: "טוען שעות פנויות...",
      noSlots: "אין שעות פנויות לתאריך זה",
      back: "חזרה",
      seatingTitle: "איזור ישיבה",
      indoor: "בפנים",
      outdoor: "בחוץ",
      bar: "בר",
      smokingTitle: "עישון",
      noSmoking: "ללא עישון",
      smoking: "אזור עישון",
      allergiesTitle: "אלרגיות",
      allergyOptions: ["אגוזים", "חלב", "גלוטן", "פירות ים", "ביצים", "סויה"],
      noAllergies: "ללא",
      nameLabel: "שם",
      phoneLabel: "טלפון",
      specialLabel: "בקשות מיוחדות",
      specialPlaceholder: "כסא תינוק, יום הולדת, וכו׳...",
      phoneError: "מספר טלפון לא תקין",
      submit: "אישור הזמנה",
      submitting: "שולח...",
      confirmed: "ההזמנה התקבלה!",
      confirmNote: "אישור יישלח אליך בוואטסאפ",
      at: "בשעה",
    },
  },
  en: {
    nav: { modules: "Modules", pricing: "Pricing", demo: "Live demo", contact: "Contact" },
    hero: {
      title: "OpenSeat",
      subtitle: "Your restaurant's smartest team member",
      desc: "Reservations + membership club on WhatsApp. OpenSeat gives restaurants bookings, guest relationships, and their own white-label dashboard in one system that runs on their website and any tablet.",
      cta1: "See pricing",
      cta2: "See live demo",
      trusted: "Powered by AI - works 24/7 without breaks",
    },
    stats: [
      { value: "24/7", label: "AI assistant active" },
      { value: "1-2 hrs", label: "saved daily" },
      { value: "WhatsApp + site", label: "where guests already are" },
      { value: "3×", label: "repeat visits" },
    ],
    modulesTitle: "Three modules. One complete system.",
    modulesSubtitle: "Start with reservations and a membership club. Guest CRM, WhatsApp, and your dashboard sit in the same system.",
    modules: [
      {
        icon: "🟢",
        name: "OpenSeat Live",
        tagline: "Reservations engine",
        desc: "Smart table assignment, waitlist, owner dashboard, and website widget - all real-time, on any tablet.",
        features: [
          "Automatic table assignment by party size",
          "Real-time availability based on operating hours",
          "Operating hours and special dates management",
          "Auto-waitlist with smart matching",
          "15-minute countdown to accept an opened slot",
          "Owner dashboard with daily snapshot and occupancy view",
          "Create reservations from the dashboard for phone calls",
          "Website booking widget - mobile-first, RTL, one line of code",
          "Automatic reminders before arrival",
          "No-show tracking and reporting",
        ],
      },
      {
        icon: "🔵",
        name: "OpenSeat Connect",
        tagline: "Guest relationship layer",
        desc: "Guest CRM, repeat-guest recognition, WhatsApp AI, and owner visibility - better guest relationships without another app.",
        features: [
          "Guest CRM - full profile auto-created from the first booking",
          "Complete visit history with preferences and staff notes",
          "Dietary preferences, allergies, and celebration moments",
          "Auto-tags: VIP, returning, new, at-risk, big-table organizer",
          "Sentiment analysis to surface who needs attention",
          "Automatic thank-you after a visit",
          "Review request only when it makes sense",
          "Birthday and celebration offers with the right perk",
          "Comeback messages for guests who have gone quiet",
          "WhatsApp AI for bookings, questions, and membership status",
          "Automatic language detection - Hebrew, English, Arabic",
          "Daily owner summary on WhatsApp",
        ],
      },
      {
        icon: "🟣",
        name: "OpenSeat Club",
        tagline: "Membership club layer",
        desc: "Points, VIP tiers, rewards, and referrals - a membership club that gives guests a real reason to come back.",
        features: [
          "Points on visits and orders based on your restaurant rules",
          "Automatic VIP tiers by visit frequency and value",
          "Reward catalog with simple staff redemption flow",
          "Birthday perks, celebration moments, and visit milestones",
          "Member-get-member referrals with rewards for both sides",
          "Guests can check balance and status on WhatsApp instantly",
          "Hosts see who is a member, who is VIP, and who is close to the next reward",
          "Turns one-time diners into long-term regulars",
        ],
      },
    ] as Module[],
    howTitle: "How it works",
    howSteps: [
      { num: "1", title: "Reservation comes in", desc: "Guests book via WhatsApp, your website, or phone - everything lands in one place" },
      { num: "2", title: "OpenSeat confirms", desc: "The system assigns the table, sends confirmation, and gives the team a calmer service flow" },
      { num: "3", title: "Guest gets recognized", desc: "Staff sees if this is a returning guest, member, or VIP and what matters before seating" },
      { num: "4", title: "You bring them back", desc: "After the visit, points, rewards, or comeback messages keep the relationship moving" },
    ],
    whyTitle: "Why OpenSeat",
    whyPoints: [
      { icon: "⏰", title: "Save 1-2 hours a day", desc: "Fewer calls, fewer manual updates, and less chaos between WhatsApp, the website, and paper notes." },
      { icon: "🤝", title: "Better guest relationships", desc: "Guest history, preferences, and important moments stay in one place so service feels personal." },
      { icon: "📈", title: "Higher retention", desc: "Membership, rewards, and the right follow-up give more guests a reason to return." },
      { icon: "💬", title: "WhatsApp + any tablet", desc: "Guests stay on WhatsApp. Staff works from any tablet or browser already in the restaurant." },
      { icon: "🎨", title: "White-label + your own dashboard", desc: "Your brand, your widget, your owner dashboard - not another generic platform experience." },
      { icon: "₪", title: "Affordable monthly pricing", desc: "Clear pricing built for independents, without expensive hardware or bloated enterprise costs." },
    ],
    comparisonTitle: "Comparison",
    comparison: {
      headers: ["", "OpenSeat", "Ontopo", "Tabit", "SevenRooms"],
      rows: [
        ["Online reservations", "v", "v", "v", "v"],
        ["WhatsApp AI assistant", "v", "x", "x", "x"],
        ["Guest CRM", "v", "x", "~", "v"],
        ["Membership club", "v", "x", "x", "~"],
        ["Website widget", "v", "x", "v", "v"],
        ["Owner dashboard", "v", "~", "v", "v"],
        ["White-label branding", "v", "x", "~", "~"],
        ["Data ownership", "v", "x", "~", "~"],
        ["Standard price", "from ₪499", "Free", "₪800+", "$500+"],
      ],
    },
    launch: {
      title: "Pilot launch price - First 5 restaurants",
      desc: "Full Growth package for ₪299/mo for the first 5 restaurants. This is a monthly launch price, not a one-time payment.",
      cta: "Talk to us",
      note: "After the first 5 spots, standard Growth pricing applies.",
    },
    pricing: {
      title: "Pricing",
      subtitle: "Monthly plans by restaurant size. 14-day free trial.",
    },
    plans: [
      {
        name: "Live",
        desc: "Reservations + Widget + Dashboard",
        module: "OpenSeat Live",
        tiers: [
          { seats: "Up to 40", price: 499 },
          { seats: "Up to 80", price: 699 },
          { seats: "Up to 150", price: 999 },
          { seats: "150+", price: 1399 },
        ],
      },
      {
        name: "Growth",
        desc: "Live + Connect + Club - reservations, CRM, and membership club",
        module: "OpenSeat Live + Connect + Club",
        popular: true,
        tiers: [
          { seats: "Up to 40", price: 799 },
          { seats: "Up to 80", price: 1099 },
          { seats: "Up to 150", price: 1499 },
          { seats: "150+", price: 1999 },
        ],
      },
    ],
    annual: "Annual discount: pay 10 months, get 12.",
    addons: {
      title: "Later add-ons",
      items: [
        { name: "Employee management & training", price: "Later", desc: "Shifts, permissions, onboarding, and staff training in one place" },
        { name: "Supplier management", price: "Later", desc: "Suppliers, purchase flow, and operational coordination from the dashboard" },
        { name: "Inventory management", price: "Later", desc: "Stock levels, shortages, and reminders tied to kitchen and bar rhythm" },
      ],
    },
    faq: {
      title: "FAQ",
      items: [
        { q: "Do I need technical knowledge?", a: "No. The widget embeds in one line, the dashboard runs in your browser, and WhatsApp works on its own." },
        { q: "What happens after the trial?", a: "You choose a plan and keep going. No surprises and no small print." },
        { q: "Will it run on the tablet I already have?", a: "Yes. The whole system is browser-based and works on any normal tablet or computer." },
        { q: "Can I use my own branding?", a: "Yes. The widget, dashboard, and guest experience can all match your brand." },
        { q: "What languages does it support?", a: "Hebrew, English, and Arabic with automatic guest language detection." },
        { q: "Do I really own my data?", a: "Yes. Your restaurant owns the guest data and CRM." },
      ],
    },
    demoTitle: "Live booking demo",
    demoSubtitle: "This is how booking looks on your website - fast, clean, and built for real guests.",
    widget: {
      title: "Reserve a Table",
      restaurant: "BFF Ra'anana",
      dateLabel: "Date",
      partySizeLabel: "Party Size",
      continue: "Continue",
      slotsFor: "Available times for ",
      diners: "guests",
      loadingSlots: "Loading available times...",
      noSlots: "No available times for this date",
      back: "Back",
      seatingTitle: "Seating Area",
      indoor: "Indoor",
      outdoor: "Outdoor",
      bar: "Bar",
      smokingTitle: "Smoking",
      noSmoking: "Non-smoking",
      smoking: "Smoking area",
      allergiesTitle: "Allergies",
      allergyOptions: ["Nuts", "Dairy", "Gluten", "Seafood", "Eggs", "Soy"],
      noAllergies: "None",
      nameLabel: "Name",
      phoneLabel: "Phone",
      specialLabel: "Special requests",
      specialPlaceholder: "High chair, birthday, etc...",
      phoneError: "Invalid phone number",
      submit: "Confirm Reservation",
      submitting: "Submitting...",
      confirmed: "Reservation Confirmed!",
      confirmNote: "Confirmation will be sent via WhatsApp",
      at: "at",
    },
  },
  ar: {
    nav: { modules: "الوحدات", pricing: "الأسعار", demo: "عرض حي", contact: "تواصل" },
    hero: {
      title: "OpenSeat",
      subtitle: "أذكى عضو في فريق مطعمك",
      desc: "الحجوزات + نادي الأعضاء على واتساب. OpenSeat يجمع الحجوزات، العلاقة مع الضيوف، ولوحة المالك في نظام واحد يعمل على موقعك وعلى أي تابلت.",
      cta1: "شاهد الأسعار",
      cta2: "شاهد العرض الحي",
      trusted: "مدعوم بالذكاء الاصطناعي - يعمل 24/7 بدون توقف",
    },
    stats: [
      { value: "24/7", label: "مساعد AI نشط" },
      { value: "1-2 ساعة", label: "توفير يومي" },
      { value: "واتساب + موقع", label: "حيث الضيوف موجودون أصلًا" },
      { value: "3×", label: "زيارات متكررة" },
    ],
    modulesTitle: "ثلاث وحدات. نظام متكامل.",
    modulesSubtitle: "ابدأ بالحجوزات ونادي الأعضاء. CRM الضيوف، واتساب، ولوحة التحكم موجودة كلها في نفس النظام.",
    modules: [
      {
        icon: "🟢",
        name: "OpenSeat Live",
        tagline: "محرك الحجوزات",
        desc: "تعيين طاولات ذكي، قائمة انتظار، لوحة مالك، وودجة للموقع - كل شيء لحظي وعلى أي تابلت.",
        features: [
          "تعيين طاولات تلقائي حسب حجم المجموعة",
          "توفر فوري حسب ساعات العمل",
          "إدارة ساعات العمل والتواريخ الخاصة",
          "قائمة انتظار تلقائية مع مطابقة ذكية",
          "عد تنازلي 15 دقيقة لقبول المكان المفتوح",
          "لوحة مالك مع ملخص يومي ونظرة على الإشغال",
          "إنشاء حجوزات من لوحة التحكم للمكالمات الهاتفية",
          "ودجة حجز للموقع - موبايل أولًا، RTL، وسطر كود واحد",
          "تذكيرات تلقائية قبل الوصول",
          "تتبع عدم الحضور والتقارير",
        ],
      },
      {
        icon: "🔵",
        name: "OpenSeat Connect",
        tagline: "طبقة العلاقة مع الضيوف",
        desc: "CRM الضيوف، معرفة الزبون العائد، واتساب AI، ورؤية واضحة للمالك - علاقة أفضل مع الضيف بدون تطبيق إضافي.",
        features: [
          "CRM ضيوف - ملف كامل يُنشأ تلقائيًا من أول حجز",
          "سجل زيارات كامل مع التفضيلات وملاحظات الطاقم",
          "تفضيلات غذائية، حساسيات، ومناسبات خاصة",
          "وسوم تلقائية: VIP، عائد، جديد، معرض للخطر، منظم طاولات كبيرة",
          "تحليل مشاعر لمعرفة من يحتاج اهتمامًا",
          "رسالة شكر تلقائية بعد الزيارة",
          "طلب تقييم فقط عندما يكون التوقيت مناسبًا",
          "عروض عيد ميلاد واحتفالات مع الامتياز المناسب",
          "رسائل عودة للضيوف الذين انقطعوا لفترة",
          "واتساب AI للحجوزات، الأسئلة، وحالة العضوية",
          "كشف لغة تلقائي - عبري، إنجليزي، عربي",
          "ملخص يومي للمالك على واتساب",
        ],
      },
      {
        icon: "🟣",
        name: "OpenSeat Club",
        tagline: "طبقة نادي الأعضاء",
        desc: "نقاط، درجات VIP، مكافآت، وإحالات - نادي أعضاء يعطي الضيف سببًا حقيقيًا للعودة مرة بعد مرة.",
        features: [
          "نقاط على الزيارات والطلبات حسب قواعد مطعمك",
          "درجات VIP تلقائية حسب تكرار الزيارة وقيمتها",
          "كتالوج مكافآت مع استبدال بسيط للطاقم",
          "امتيازات عيد الميلاد، المناسبات، ومحطات الزيارة المهمة",
          "إحالات عضو يجلب عضو مع مكافأة للطرفين",
          "الضيف يفحص الرصيد والحالة على واتساب فورًا",
          "المضيف يرى من هو عضو، من هو VIP، ومن اقترب من المكافأة التالية",
          "يحوّل الزائر لمرة واحدة إلى زبون دائم",
        ],
      },
    ] as Module[],
    howTitle: "كيف يعمل",
    howSteps: [
      { num: "1", title: "الحجز يدخل", desc: "الضيف يحجز عبر واتساب، موقعك، أو الهاتف - وكل شيء يدخل إلى مكان واحد" },
      { num: "2", title: "OpenSeat يؤكد", desc: "النظام يعيّن الطاولة، يرسل التأكيد، ويعطي الفريق خدمة أهدأ وأسهل" },
      { num: "3", title: "التعرّف على الضيف", desc: "الطاقم يرى هل هذا ضيف عائد أو عضو أو VIP وما المهم قبل جلوسه" },
      { num: "4", title: "إعادته مرة أخرى", desc: "بعد الزيارة، النقاط أو المكافآت أو رسائل العودة تواصل العلاقة مع الضيف" },
    ],
    whyTitle: "لماذا OpenSeat",
    whyPoints: [
      { icon: "⏰", title: "يوفر 1-2 ساعة يوميًا", desc: "مكالمات أقل، تحديثات يدوية أقل، وفوضى أقل بين واتساب والموقع والورق." },
      { icon: "🤝", title: "علاقة أفضل مع الضيوف", desc: "تاريخ الضيف وتفضيلاته ولحظاته المهمة تبقى في مكان واحد فيصبح التعامل شخصيًا أكثر." },
      { icon: "📈", title: "احتفاظ أعلى", desc: "العضوية والمكافآت والمتابعة الصحيحة تعطى الضيوف سببًا إضافيًا للعودة." },
      { icon: "💬", title: "واتساب + أي تابلت", desc: "الضيوف يبقون على واتساب، والطاقم يعمل من أي تابلت أو متصفح موجود في المطعم." },
      { icon: "🎨", title: "White-label + لوحة التحكم الخاصة بك", desc: "علامتك، ودجتك، ولوحة المالك الخاصة بك - وليس تجربة منصة عامة." },
      { icon: "₪", title: "سعر شهري مناسب", desc: "تسعير واضح للمطاعم المستقلة بدون أجهزة باهظة أو تكاليف منتفخة." },
    ],
    comparisonTitle: "المقارنة",
    comparison: {
      headers: ["", "OpenSeat", "Ontopo", "Tabit", "SevenRooms"],
      rows: [
        ["حجوزات أونلاين", "v", "v", "v", "v"],
        ["مساعد واتساب AI", "v", "x", "x", "x"],
        ["CRM ضيوف", "v", "x", "~", "v"],
        ["نادي الأعضاء", "v", "x", "x", "~"],
        ["ودجة للموقع", "v", "x", "v", "v"],
        ["لوحة مالك", "v", "~", "v", "v"],
        ["علامتك الخاصة", "v", "x", "~", "~"],
        ["ملكية البيانات", "v", "x", "~", "~"],
        ["السعر العادي", "من ₪499", "مجاني", "₪800+", "$500+"],
      ],
    },
    launch: {
      title: "سعر إطلاق البايلوت - أول 5 مطاعم",
      desc: "حزمة Growth الكاملة بـ ₪299 شهريًا لأول 5 مطاعم. هذا سعر شهري للإطلاق وليس دفعة لمرة واحدة.",
      cta: "تحدث معنا",
      note: "بعد امتلاء أول 5 أماكن، يعود السعر العادي لخطة Growth.",
    },
    pricing: {
      title: "الأسعار",
      subtitle: "خطط شهرية حسب حجم المطعم. 14 يوم تجربة مجانية.",
    },
    plans: [
      {
        name: "Live",
        desc: "حجوزات + ودجة + لوحة تحكم",
        module: "OpenSeat Live",
        tiers: [
          { seats: "حتى 40", price: 499 },
          { seats: "حتى 80", price: 699 },
          { seats: "حتى 150", price: 999 },
          { seats: "150+", price: 1399 },
        ],
      },
      {
        name: "Growth",
        desc: "Live + Connect + Club - حجوزات وCRM ونادي أعضاء",
        module: "OpenSeat Live + Connect + Club",
        popular: true,
        tiers: [
          { seats: "حتى 40", price: 799 },
          { seats: "حتى 80", price: 1099 },
          { seats: "حتى 150", price: 1499 },
          { seats: "150+", price: 1999 },
        ],
      },
    ],
    annual: "خصم سنوي: ادفع 10 أشهر، احصل على 12.",
    addons: {
      title: "إضافات لاحقًا",
      items: [
        { name: "إدارة الموظفين والتدريب", price: "لاحقًا", desc: "مناوبات، صلاحيات، وتأهيل الفريق في مكان واحد" },
        { name: "إدارة الموردين", price: "لاحقًا", desc: "الموردون وطلبات الشراء والتنسيق التشغيلي من لوحة التحكم" },
        { name: "إدارة المخزون", price: "لاحقًا", desc: "مخزون، نواقص، وتذكيرات مرتبطة بإيقاع المطبخ والبار" },
      ],
    },
    faq: {
      title: "أسئلة شائعة",
      items: [
        { q: "هل أحتاج معرفة تقنية؟", a: "لا. الودجة تُضمّن بسطر واحد، لوحة التحكم تعمل من المتصفح، وواتساب يعمل وحده." },
        { q: "ماذا يحدث بعد التجربة؟", a: "تختار الخطة المناسبة وتكمل. بدون مفاجآت وبدون تفاصيل مخفية." },
        { q: "هل يعمل على التابلت الموجود عندي؟", a: "نعم. النظام كله يعمل من المتصفح وعلى أي تابلت أو كمبيوتر عادي." },
        { q: "هل أستطيع استخدام علامتي التجارية؟", a: "نعم. الودجة ولوحة التحكم وتجربة الضيف يمكن أن تحمل علامتك." },
        { q: "ما اللغات التي يدعمها؟", a: "العبرية والإنجليزية والعربية مع كشف تلقائي للغة الضيف." },
        { q: "هل أملك بياناتي فعلًا؟", a: "نعم. مطعمك يملك بيانات الضيوف وCRM بالكامل." },
      ],
    },
    demoTitle: "عرض حي للحجز",
    demoSubtitle: "هكذا يبدو الحجز على موقعك - سريع، واضح، ومصمم لضيوف حقيقيين.",
    widget: {
      title: "حجز طاولة",
      restaurant: "BFF Ra'anana",
      dateLabel: "التاريخ",
      partySizeLabel: "عدد الضيوف",
      continue: "متابعة",
      slotsFor: "الأوقات المتاحة لـ ",
      diners: "ضيوف",
      loadingSlots: "جارٍ تحميل الأوقات...",
      noSlots: "لا توجد أوقات متاحة لهذا التاريخ",
      back: "رجوع",
      seatingTitle: "منطقة الجلوس",
      indoor: "داخلي",
      outdoor: "خارجي",
      bar: "بار",
      smokingTitle: "التدخين",
      noSmoking: "بدون تدخين",
      smoking: "منطقة تدخين",
      allergiesTitle: "الحساسيات",
      allergyOptions: ["مكسرات", "حليب", "غلوتين", "مأكولات بحرية", "بيض", "صويا"],
      noAllergies: "لا يوجد",
      nameLabel: "الاسم",
      phoneLabel: "الهاتف",
      specialLabel: "طلبات خاصة",
      specialPlaceholder: "كرسي أطفال، عيد ميلاد، إلخ...",
      phoneError: "رقم هاتف غير صالح",
      submit: "تأكيد الحجز",
      submitting: "جارٍ الإرسال...",
      confirmed: "تم تأكيد الحجز!",
      confirmNote: "سيتم إرسال التأكيد عبر واتساب",
      at: "الساعة",
    },
  },
};

/* ── Constants ── */
const API_URL = "http://204.168.227.45";
const RESTAURANT_ID = "c3c22e37-a309-4fde-aa6c-6e714212a3bc";

/* ── Accessibility Widget ── */
const a11yStorageKey = "openseat-accessibility-settings";
const a11yDefaults = { fontScale: 1, contrast: false, links: false, readableFont: false, reducedMotion: false };

function AccessibilityWidget({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(a11yDefaults);

  const copy = {
    he: { button: "נגישות", title: "כלי נגישות", close: "סגירה", textSize: "גודל טקסט", decrease: "A-", resetSize: "איפוס", increase: "A+", contrast: "ניגודיות גבוהה", linksLabel: "קו תחתון לקישורים", readable: "פונט קריא", motion: "הפחתת תנועה", resetAll: "איפוס הכל" },
    en: { button: "Accessibility", title: "Accessibility Tools", close: "Close", textSize: "Text size", decrease: "A-", resetSize: "Reset", increase: "A+", contrast: "High contrast", linksLabel: "Underline links", readable: "Readable font", motion: "Reduce motion", resetAll: "Reset all" },
    ar: { button: "إمكانية الوصول", title: "أدوات إمكانية الوصول", close: "إغلاق", textSize: "حجم النص", decrease: "A-", resetSize: "إعادة", increase: "A+", contrast: "تباين عالي", linksLabel: "خط تحت الروابط", readable: "خط مقروء", motion: "تقليل الحركة", resetAll: "إعادة تعيين الكل" },
  }[lang];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(a11yStorageKey);
      if (raw) {
        const p = JSON.parse(raw);
        const s = { fontScale: Math.min(1.3, Math.max(0.9, Number(p.fontScale ?? 1))), contrast: !!p.contrast, links: !!p.links, readableFont: !!p.readableFont, reducedMotion: !!p.reducedMotion };
        setSettings(s);
        applyA11y(s);
      }
    } catch { /* ignore */ }
  }, []);

  const applyA11y = (s: typeof a11yDefaults) => {
    const root = document.documentElement;
    root.style.fontSize = s.fontScale === 1 ? "" : `${s.fontScale * 100}%`;
    root.toggleAttribute("data-a11y-contrast", s.contrast);
    root.toggleAttribute("data-a11y-links", s.links);
    root.toggleAttribute("data-a11y-readable-font", s.readableFont);
    root.toggleAttribute("data-a11y-reduced-motion", s.reducedMotion);
  };

  const update = (next: typeof a11yDefaults) => {
    setSettings(next);
    applyA11y(next);
    try {
      const isDefault = next.fontScale === 1 && !next.contrast && !next.links && !next.readableFont && !next.reducedMotion;
      if (isDefault) localStorage.removeItem(a11yStorageKey);
      else localStorage.setItem(a11yStorageKey, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const isRtl = lang !== "en";
  const posClass = isRtl ? "left-4" : "right-4";
  const panelAlign = isRtl ? "left-0" : "right-0";

  return (
    <div className={`fixed bottom-4 ${posClass} z-[100] flex flex-col ${isRtl ? "items-start" : "items-end"}`}>
      {open && (
        <div className={`absolute bottom-full ${panelAlign} mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur`}
          role="dialog" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{copy.title}</h2>
            <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-900">{copy.close}</button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-semibold">{copy.textSize}</p>
              <div className="flex flex-wrap gap-2">
                {[{ label: copy.decrease, fn: () => update({ ...settings, fontScale: Math.max(0.9, settings.fontScale - 0.1) }) },
                  { label: copy.resetSize, fn: () => update({ ...settings, fontScale: 1 }) },
                  { label: copy.increase, fn: () => update({ ...settings, fontScale: Math.min(1.3, settings.fontScale + 0.1) }) },
                ].map((b) => (
                  <button key={b.label} onClick={b.fn} className="min-w-[4.5rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium" style={{ borderColor: undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = pal.accentBorder)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}>{b.label}</button>
                ))}
              </div>
            </div>
            {([
              ["contrast", copy.contrast],
              ["links", copy.linksLabel],
              ["readableFont", copy.readable],
              ["reducedMotion", copy.motion],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium cursor-pointer">
                <span>{label}</span>
                <input type="checkbox" checked={settings[key] as boolean} onChange={(e) => update({ ...settings, [key]: e.target.checked })}
                  className="h-5 w-5 shrink-0" style={{ accentColor: pal.accent }} />
              </label>
            ))}
            <button onClick={() => update(a11yDefaults)}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition"
              style={{ background: pal.accent }}
              onMouseEnter={(e) => (e.currentTarget.style.background = pal.accentHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = pal.accent)}>{copy.resetAll}</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={copy.button}
        className="inline-flex items-center gap-2 rounded-full px-3 py-3 text-white shadow-lg transition hover:-translate-y-0.5"
        style={{ background: pal.accent, boxShadow: `0 10px 15px -3px ${pal.shadow}`, borderColor: pal.accentBorder, borderWidth: 1 }}>
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v4.5m0 0l-4.5 1.5m4.5-1.5l4.5 1.5M10 22l2-6 2 6m-6-3h8" />
        </svg>
        <span className="hidden text-sm font-semibold sm:inline">{copy.button}</span>
      </button>
    </div>
  );
}

/* ── Contact Form ── */
const FORMSPREE_URL = "https://formspree.io/f/xdapylqr";
const CAL_LINK = "https://cal.com/openseat/intro";

function ContactForm({ lang }: { lang: Lang }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const labels = {
    he: { title: "דבר איתנו", name: "שם מלא", email: "אימייל", restaurant: "שם המסעדה", phone: "טלפון", seats: "מספר מושבים", message: "הודעה (אופציונלי)", send: "שלח הודעה", sending: "שולח...", sent: "ההודעה נשלחה! נחזור אליך בהקדם.", error: "משהו השתבש. נסה שוב או שלח מייל ל-milhemsione@gmail.com", schedule: "או קבע שיחה", scheduleBtn: "קבע שיחת 15 דקות" },
    en: { title: "Get in touch", name: "Full name", email: "Email", restaurant: "Restaurant name", phone: "Phone", seats: "Number of seats", message: "Message (optional)", send: "Send message", sending: "Sending...", sent: "Message sent! We'll get back to you shortly.", error: "Something went wrong. Try again or email milhemsione@gmail.com", schedule: "Or schedule a call", scheduleBtn: "Schedule a 15-min call" },
    ar: { title: "تواصل معنا", name: "الاسم الكامل", email: "البريد الإلكتروني", restaurant: "اسم المطعم", phone: "الهاتف", seats: "عدد المقاعد", message: "رسالة (اختياري)", send: "أرسل رسالة", sending: "جارٍ الإرسال...", sent: "تم إرسال الرسالة! سنعود إليك قريباً.", error: "حدث خطأ. حاول مرة أخرى أو أرسل بريد إلى milhemsione@gmail.com", schedule: "أو حدد موعد مكالمة", scheduleBtn: "حدد مكالمة 15 دقيقة" },
  };
  const l = labels[lang];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: "POST",
        body: new FormData(e.currentTarget),
        headers: { Accept: "application/json" },
      });
      setStatus(res.ok ? "sent" : "error");
      if (res.ok) (e.target as HTMLFormElement).reset();
    } catch {
      setStatus("error");
    }
  };

  const inputCls = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none transition";

  return (
    <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-start">
      <div>
        <h2 className="text-3xl font-bold mb-4">{l.title}</h2>
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: pal.iconBg }}>
              <span className="text-xl">&#128337;</span>
            </div>
            <div>
              <p className="font-semibold">{lang === "he" ? "15 דקות, בלי בלבולים" : lang === "ar" ? "15 دقيقة، بدون تعقيد" : "15 minutes, no fluff"}</p>
              <p className="text-sm text-gray-500">{lang === "he" ? "שיחה קצרה, תשובות אמיתיות." : lang === "ar" ? "مكالمة قصيرة، إجابات حقيقية." : "Quick call, real answers."}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: pal.iconBg }}>
              <span className="text-xl">&#9989;</span>
            </div>
            <div>
              <p className="font-semibold">{lang === "he" ? "התסריטים שלך, לא שלנו" : lang === "ar" ? "سيناريوهاتك، ليس سيناريوهاتنا" : "Your scenarios, not ours"}</p>
              <p className="text-sm text-gray-500">{lang === "he" ? "ספר לנו על המסעדה ונראה לך תוצאות רלוונטיות." : lang === "ar" ? "أخبرنا عن مطعمك وسنعرض لك نتائج ذات صلة." : "Tell us about your restaurant and we'll show relevant results."}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: pal.iconBg }}>
              <span className="text-xl">&#128172;</span>
            </div>
            <div>
              <p className="font-semibold">{lang === "he" ? "הדגמה חיה בוואטסאפ" : lang === "ar" ? "عرض مباشر على واتساب" : "Live WhatsApp walkthrough"}</p>
              <p className="text-sm text-gray-500">{lang === "he" ? "ראה בדיוק מה האורחים שלך יחוו." : lang === "ar" ? "شاهد بالضبط ما سيختبره ضيوفك." : "See exactly what your guests will experience."}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">{l.schedule}</p>
          <a href={CAL_LINK} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 rounded-xl font-semibold transition"
            style={{ borderColor: pal.accent, color: pal.accentText }}>
            <span>&#128197;</span> {l.scheduleBtn}
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">{l.name}</label>
          <input type="text" id="name" name="name" required className={inputCls} style={{ "--tw-ring-color": pal.inputFocus } as any}
            onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 1px ${pal.inputFocus}`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{l.email}</label>
          <input type="email" id="email" name="email" required className={inputCls}
            onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 1px ${pal.inputFocus}`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }} />
        </div>
        <div>
          <label htmlFor="restaurant" className="block text-sm font-medium text-gray-700 mb-1">{l.restaurant}</label>
          <input type="text" id="restaurant" name="restaurant" required className={inputCls}
            onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 1px ${pal.inputFocus}`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">{l.phone}</label>
            <input type="tel" id="phone" name="phone" className={inputCls}
              onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 1px ${pal.inputFocus}`; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }} />
          </div>
          <div>
            <label htmlFor="seats" className="block text-sm font-medium text-gray-700 mb-1">{l.seats}</label>
            <select id="seats" name="seats" className={inputCls}
              onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 1px ${pal.inputFocus}`; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}>
              <option value="">-</option>
              <option value="1-30">1-30</option>
              <option value="31-60">31-60</option>
              <option value="61-100">61-100</option>
              <option value="101-150">101-150</option>
              <option value="150+">150+</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">{l.message}</label>
          <textarea id="message" name="message" rows={3} className={inputCls}
            onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 1px ${pal.inputFocus}`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }} />
        </div>
        <button type="submit" disabled={status === "sending"}
          className="w-full py-3 text-white rounded-xl font-semibold text-lg transition disabled:bg-gray-400"
          style={{ background: status === "sending" ? undefined : pal.accent }}>
          {status === "sending" ? l.sending : l.send}
        </button>
        {status === "sent" && <p className="text-green-600 text-sm text-center">{l.sent}</p>}
        {status === "error" && <p className="text-red-600 text-sm text-center">{l.error}</p>}
      </form>
    </div>
  );
}

/* ── Demo Widget ── */
interface AvailabilitySlot {
  time: string;
  availableTables: number;
  maxPartySize: number;
}

type WidgetStep = "date" | "time" | "preferences" | "details" | "confirm";
type Seating = "indoor" | "outdoor" | "bar";

function isValidIsraeliPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+972")) return /^\+972\d{8,9}$/.test(digits);
  if (digits.startsWith("0")) return /^0\d{9}$/.test(digits);
  return false;
}

const seatingIcons: Record<Seating, string> = { indoor: "🏠", outdoor: "🌿", bar: "🍷" };

function DemoWidget({ lang }: { lang: Lang }) {
  const w = t[lang].widget;
  const [step, setStep] = useState<WidgetStep>("date");
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

  const steps: WidgetStep[] = ["date", "time", "preferences", "details", "confirm"];
  const currentIdx = steps.indexOf(step);

  useEffect(() => {
    if (step !== "time" || !date) return;
    setLoadingSlots(true);
    setError("");
    const params = new URLSearchParams({ restaurantId: RESTAURANT_ID, date, partySize: String(partySize) });
    fetch(`${API_URL}/api/v1/reservations/availability?${params}`)
      .then((res) => res.json())
      .then((data) => { setSlots(data.slots || []); setLoadingSlots(false); })
      .catch(() => { setError("Error loading slots"); setLoadingSlots(false); });
  }, [step, date, partySize]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: RESTAURANT_ID, guestName: name, guestPhone: phone, date, timeStart: time, partySize, source: "web", seating, smoking, allergies, specialRequests }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Booking failed"); }
      setStep("confirm");
    } catch (e: any) { setError(e.message || "Booking failed"); }
    finally { setSubmitting(false); }
  };

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none transition text-sm";

  return (
    <div className="rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-w-md mx-auto" dir={lang === "en" ? "ltr" : "rtl"}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4" style={{ background: `linear-gradient(135deg, ${pal.accent}, ${pal.accentHover})` }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🍽️</span>
          <div>
            <h3 className="text-lg font-bold text-white">{w.title}</h3>
            <p className="text-sm text-white/70">{w.restaurant}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-1.5">
          {steps.slice(0, -1).map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
              style={{ background: i <= currentIdx ? pal.accent : "#e5e7eb" }} />
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        {error && <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

        {/* Step 1: Date & Party Size */}
        {step === "date" && (
          <div className="space-y-5 pt-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{w.dateLabel}</label>
              <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)}
                className={inputCls}
                onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.background = "#fff"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{w.partySizeLabel}</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 bg-gray-50 text-lg font-bold text-gray-600 hover:bg-gray-100 transition flex items-center justify-center">-</button>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: pal.accent }}>{partySize}</span>
                  <span className="text-sm text-gray-500">👤</span>
                </div>
                <button onClick={() => setPartySize(Math.min(20, partySize + 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 bg-gray-50 text-lg font-bold text-gray-600 hover:bg-gray-100 transition flex items-center justify-center">+</button>
              </div>
            </div>
            <button onClick={() => date && setStep("time")} disabled={!date}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition disabled:opacity-40"
              style={{ background: pal.accent }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = pal.accentHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = pal.accent)}>
              {w.continue} →
            </button>
          </div>
        )}

        {/* Step 2: Time */}
        {step === "time" && (
          <div className="pt-2">
            <p className="text-sm text-gray-500 mb-4">{w.slotsFor}{date} ({partySize} {w.diners})</p>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${pal.accent} transparent transparent transparent` }} />
                <span className="text-sm text-gray-400 ms-3">{w.loadingSlots}</span>
              </div>
            ) : slots.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{w.noSlots}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const selected = time === slot.time;
                  return (
                    <button key={slot.time} onClick={() => { setTime(slot.time); setStep("preferences"); }}
                      className="py-2.5 rounded-xl border text-sm font-semibold transition"
                      style={{
                        background: selected ? pal.accent : "#fff",
                        borderColor: selected ? pal.accent : "#e5e7eb",
                        color: selected ? "#fff" : "#374151",
                      }}
                      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = pal.accentBorder; e.currentTarget.style.background = pal.accentLight; } }}
                      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fff"; } }}>
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setStep("date")} className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition">← {w.back}</button>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === "preferences" && (
          <div className="space-y-5 pt-2">
            {/* Seating */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">{w.seatingTitle}</label>
              <div className="grid grid-cols-3 gap-2">
                {(["indoor", "outdoor", "bar"] as Seating[]).map((s) => {
                  const selected = seating === s;
                  const label = s === "indoor" ? w.indoor : s === "outdoor" ? w.outdoor : w.bar;
                  return (
                    <button key={s} onClick={() => setSeating(s)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition text-sm font-medium"
                      style={{
                        borderColor: selected ? pal.accent : "#e5e7eb",
                        background: selected ? pal.accentLight : "#fff",
                        color: selected ? pal.accentText : "#6b7280",
                      }}>
                      <span className="text-xl">{seatingIcons[s]}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smoking */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">{w.smokingTitle}</label>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((val) => {
                  const selected = smoking === val;
                  return (
                    <button key={String(val)} onClick={() => setSmoking(val)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition text-sm font-medium"
                      style={{
                        borderColor: selected ? pal.accent : "#e5e7eb",
                        background: selected ? pal.accentLight : "#fff",
                        color: selected ? pal.accentText : "#6b7280",
                      }}>
                      <span>{val ? "🚬" : "🚭"}</span>
                      {val ? w.smoking : w.noSmoking}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">{w.allergiesTitle}</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAllergies([])}
                  className="px-3 py-1.5 rounded-full border text-xs font-semibold transition"
                  style={{
                    borderColor: allergies.length === 0 ? pal.accent : "#e5e7eb",
                    background: allergies.length === 0 ? pal.accentLight : "#fff",
                    color: allergies.length === 0 ? pal.accentText : "#6b7280",
                  }}>
                  {w.noAllergies}
                </button>
                {w.allergyOptions.map((a) => {
                  const selected = allergies.includes(a);
                  return (
                    <button key={a} onClick={() => toggleAllergy(a)}
                      className="px-3 py-1.5 rounded-full border text-xs font-semibold transition"
                      style={{
                        borderColor: selected ? "#ef4444" : "#e5e7eb",
                        background: selected ? "#fef2f2" : "#fff",
                        color: selected ? "#dc2626" : "#6b7280",
                      }}>
                      {selected ? "⚠️ " : ""}{a}
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={() => setStep("details")}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition"
              style={{ background: pal.accent }}
              onMouseEnter={(e) => (e.currentTarget.style.background = pal.accentHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = pal.accent)}>
              {w.continue} →
            </button>
            <button onClick={() => setStep("time")} className="text-sm text-gray-500 hover:text-gray-700 transition block">← {w.back}</button>
          </div>
        )}

        {/* Step 4: Details */}
        {step === "details" && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              <span>📅 {date}</span>
              <span>🕐 {time}</span>
              <span>👤 {partySize}</span>
              <span>{seatingIcons[seating]} {seating === "indoor" ? w.indoor : seating === "outdoor" ? w.outdoor : w.bar}</span>
              {smoking && <span>🚬</span>}
              {allergies.length > 0 && <span>⚠️ {allergies.join(", ")}</span>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{w.nameLabel}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls}
                onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.background = "#fff"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{w.phoneLabel}</label>
              <input type="tel" value={phone}
                onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(""); }}
                onBlur={() => { if (phone && !isValidIsraeliPhone(phone)) setPhoneError(w.phoneError); }}
                className={inputCls}
                style={{ borderColor: phoneError ? "#ef4444" : undefined }}
                onFocus={(e) => { if (!phoneError) { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.background = "#fff"; } }}
              />
              {phoneError && <p className="text-red-600 text-xs mt-1">{phoneError}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{w.specialLabel}</label>
              <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder={w.specialPlaceholder} rows={2} className={inputCls}
                onFocus={(e) => { e.currentTarget.style.borderColor = pal.inputFocus; e.currentTarget.style.background = "#fff"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }} />
            </div>
            <button
              onClick={() => { if (!isValidIsraeliPhone(phone)) { setPhoneError(w.phoneError); return; } handleSubmit(); }}
              disabled={!name || !phone || submitting}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition disabled:opacity-40"
              style={{ background: submitting ? "#9ca3af" : pal.accent }}>
              {submitting ? w.submitting : w.submit}
            </button>
            <button onClick={() => setStep("preferences")} className="text-sm text-gray-500 hover:text-gray-700 transition block">← {w.back}</button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === "confirm" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: pal.accentLight }}>
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-xl font-bold mb-2">{w.confirmed}</p>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">{date} {w.at} {time}</p>
              <p className="text-sm text-gray-600">{partySize} {w.diners} - {seating === "indoor" ? w.indoor : seating === "outdoor" ? w.outdoor : w.bar}</p>
              {allergies.length > 0 && <p className="text-sm text-gray-500">⚠️ {allergies.join(", ")}</p>}
            </div>
            <p className="text-xs text-gray-400 mt-4">💬 {w.confirmNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function ComparisonCell({ v }: { v: string }) {
  if (v === "v") return <span className="text-green-600 font-bold text-lg">&#10003;</span>;
  if (v === "x") return <span className="text-red-400">&#10007;</span>;
  if (v === "~") return <span className="text-yellow-500">~</span>;
  return <span className="text-sm font-medium">{v}</span>;
}

const moduleColors: Record<string, string> = {
  "🟢": "border-green-300 bg-green-50",
  "🔵": "border-blue-300 bg-blue-50",
  "🟣": "border-purple-300 bg-purple-50",
};

const moduleAccent: Record<string, string> = {
  "🟢": "text-green-700",
  "🔵": "text-blue-700",
  "🟣": "text-purple-700",
};

/* ── Main Page ── */
export function LandingPage() {
  const [lang, setLang] = useState<Lang>("he");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const c = t[lang];
  const dir = lang === "en" ? "ltr" : "rtl";
  const pm = lang === "he" ? "/חודש" : lang === "ar" ? "/شهر" : "/mo";

  return (
    <div dir={dir} className="min-h-screen bg-white text-gray-900" style={{ direction: dir }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight" style={{ color: pal.accentText }}>OpenSeat</span>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#live-demo" className="text-gray-600 hover:text-gray-900">{c.nav.demo}</a>
            <a href="#modules" className="text-gray-600 hover:text-gray-900">{c.nav.modules}</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900">{c.nav.pricing}</a>
            <a href="#contact" className="text-gray-600 hover:text-gray-900">{c.nav.contact}</a>

            <div className="relative inline-block">
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
                className="appearance-none px-3 py-1 pe-7 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition text-sm cursor-pointer">
                <option value="he">עברית</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
              <svg className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-2 w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-3 md:hidden">

            <div className="relative inline-block">
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
                className="appearance-none px-2 py-1 pe-6 border border-gray-300 rounded-lg bg-white text-sm cursor-pointer">
                <option value="he">עב</option>
                <option value="en">EN</option>
                <option value="ar">عر</option>
              </select>
              <svg className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-1.5 w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2 text-gray-600" aria-label="Menu">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenu
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden mt-3 pb-2 border-t border-gray-100 pt-3 flex flex-col gap-3 text-sm">
            <a href="#live-demo" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.demo}</a>
            <a href="#modules" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.modules}</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.pricing}</a>
            <a href="#contact" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.contact}</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <header className="px-4 sm:px-6 py-12 sm:py-20 text-center" style={{ background: `linear-gradient(to bottom, ${pal.gradientStart}, white)` }}>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">{c.hero.title}</h1>
        <p className="text-xl sm:text-2xl md:text-3xl text-gray-700 mt-3 font-medium">{c.hero.subtitle}</p>
        <p className="text-base sm:text-lg text-gray-500 mt-4 max-w-2xl mx-auto">{c.hero.desc}</p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <a href="#pricing" className="px-6 py-3 text-white rounded-xl font-semibold transition"
            style={{ background: pal.accent }}
            onMouseEnter={(e) => (e.currentTarget.style.background = pal.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = pal.accent)}>{c.hero.cta1}</a>
          <a href="#live-demo" className="px-6 py-3 border-2 rounded-xl font-semibold transition"
            style={{ borderColor: pal.accent, color: pal.accentText }}
            onMouseEnter={(e) => (e.currentTarget.style.background = pal.secondaryHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{c.hero.cta2}</a>
        </div>
        <p className="text-sm text-gray-400 mt-6">{c.hero.trusted}</p>
      </header>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gray-50 px-6 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {c.stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold" style={{ color: pal.stat }}>{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">{c.howTitle}</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {c.howSteps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 text-white rounded-full flex items-center justify-center text-lg md:text-xl font-bold mx-auto mb-3"
                style={{ background: pal.accent }}>{step.num}</div>
              <h3 className="font-bold mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why OpenSeat */}
      <section className="px-6 py-16 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">{c.whyTitle}</h2>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {c.whyPoints.map((p) => (
            <div key={p.title} className="border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition">
              <span className="text-3xl">{p.icon}</span>
              <h3 className="text-lg font-bold mt-3 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="px-6 py-20 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-2">{c.modulesTitle}</h2>
        <p className="text-center text-gray-500 mb-12">{c.modulesSubtitle}</p>
        <div className="max-w-5xl mx-auto space-y-6">
          {c.modules.map((mod, idx) => (
            <div key={mod.name} className={`border-2 rounded-2xl overflow-hidden transition ${moduleColors[mod.icon] || "border-gray-200 bg-white"}`}>
              <button
                onClick={() => setExpandedModule(expandedModule === idx ? null : idx)}
                className="w-full px-6 py-5 flex items-center gap-4 text-start"
              >
                <span className="text-3xl">{mod.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-bold">{mod.name}</h3>
                    <span className={`text-sm font-semibold ${moduleAccent[mod.icon] || "text-gray-600"}`}>{mod.tagline}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{mod.desc}</p>
                </div>
                <span className={`text-2xl text-gray-400 transition-transform shrink-0 ${expandedModule === idx ? "rotate-45" : ""}`}>+</span>
              </button>
              {expandedModule === idx && (
                <div className="px-6 pb-6">
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                    {mod.features.map((f, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="mt-0.5 shrink-0" style={{ color: pal.bullet }}>&#9679;</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                  <th key={i} className={`px-4 py-3 font-semibold ${i === 0 ? "text-start" : "text-center"}`}
                    style={{ color: i === 1 ? pal.accentText : "#4b5563", background: i === 1 ? pal.compHeader : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.comparison.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-gray-100">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3 ${ci === 0 ? "text-start font-medium" : "text-center"}`}
                      style={{ background: ci === 1 ? pal.compHighlight : undefined }}>
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
      <section className="px-6 py-16 border-y-2" style={{ background: pal.launchBg, borderColor: pal.launchBorder }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{c.launch.title}</h2>
          <p className="text-xl text-gray-700 mb-6">{c.launch.desc}</p>
          <a href="#contact" className="inline-block px-8 py-4 text-white rounded-xl font-semibold text-lg transition"
            style={{ background: pal.launchAccent }}
            onMouseEnter={(e) => (e.currentTarget.style.background = pal.launchHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = pal.launchAccent)}>{c.launch.cta}</a>
          <p className="text-sm text-gray-500 mt-4">{c.launch.note}</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-4">{c.pricing.title}</h2>
        <p className="text-center text-gray-500 mb-12">{c.pricing.subtitle}</p>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {c.plans.map((plan) => (
            <div key={plan.name} className="rounded-2xl p-8 relative"
              style={{
                background: plan.popular ? pal.accentLight : "#fff",
                border: plan.popular ? `2px solid ${pal.accentBorder}` : "1px solid #e5e7eb",
              }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-white text-xs font-bold rounded-full"
                  style={{ background: pal.popularBadge }}>
                  {lang === "he" ? "הכי פופולרי" : lang === "ar" ? "الأكثر شعبية" : "Most popular"}
                </div>
              )}
              <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
              <p className="text-gray-500 text-sm mb-2">{plan.desc}</p>
              <p className="text-xs font-semibold mb-4" style={{ color: pal.accentText }}>{plan.module}</p>
              <div className="space-y-2 border-t border-gray-100 pt-4">
                {plan.tiers.map((tier) => (
                  <div key={tier.seats} className="flex justify-between text-sm">
                    <span>{tier.seats} {lang === "he" ? "מושבים" : lang === "ar" ? "مقعد" : "seats"}</span>
                    <span className="font-bold">&#8362;{tier.price}{pm}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-8">{c.annual}</p>
      </section>

      {/* Live Demo Widget */}
      <section id="live-demo" className="px-6 py-20" style={{ background: `linear-gradient(to bottom, white, ${pal.gradientStart})` }}>
        <h2 className="text-3xl font-bold text-center mb-2">{c.demoTitle}</h2>
        <p className="text-center text-gray-500 mb-10">{c.demoSubtitle}</p>
        <DemoWidget lang={lang} />
      </section>

      {/* Add-ons */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">{c.addons.title}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {c.addons.items.map((a) => (
            <div key={a.name} className="border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold">{a.name}</span>
                <span className="font-bold text-sm" style={{ color: pal.accentText }}>{a.price}</span>
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

      {/* Contact */}
      <section id="contact" className="px-6 py-20" style={{ background: `linear-gradient(to bottom, white, ${pal.gradientStart})` }}>
        <ContactForm lang={lang} />
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        OpenSeat &copy; 2026
      </footer>

      {/* Accessibility Widget */}
      <AccessibilityWidget lang={lang} />
    </div>
  );
}
