import { useState, useEffect, useRef, type FormEvent } from "react";

type Lang = "he" | "en" | "ar";

/* ═══════════════════════════════════════════════════════════
   I18N -trilingual copy (HE primary, EN, AR)
   ═══════════════════════════════════════════════════════════ */
const I18N = {
  he: {
    dir: "rtl" as const, code: "HE",
    nav: { modules: "מודולים", how: "איך זה עובד", pricing: "מחירון", demo: "דמו חי", contact: "צור קשר", cta: "דברו איתנו" },
    hero: {
      badge: "פיילוט · 5 מסעדות ראשונות · ₪299/חודש",
      title1: "חבר הצוות", title2: "הכי חכם", title3: "של המסעדה.",
      desc: "הזמנות אונליין ומועדון חברים בוואטסאפ. OpenSeat מרכז הזמנות, קשר עם אורחים, ודשבורד לבעלים - במערכת אחת שרצה על האתר שלך ועל כל טאבלט.",
      cta1: "ראה דמו חי", cta2: "ראה מחירים",
      trust: "עובד 24/7 · מופעל ע״י AI · עברית, אנגלית, ערבית",
    },
    tape: ["הזמנות אונליין", "בוט וואטסאפ AI", "מועדון חברים", "CRM אורחים", "ווידג׳ט לאתר", "דשבורד בעלים"],
    stats: [
      { k: "24/7", v: "AI פעיל, בלי הפסקות" },
      { k: "1-2 שעות", v: "חיסכון יומי לכל משמרת" },
      { k: "3×", v: "יותר אורחים חוזרים" },
      { k: "100%", v: "האתר והמותג נשארים שלך" },
    ],
    modulesTitle: "שלושה מודולים.", modulesTitle2: "מערכת אחת שלמה.",
    modulesSub: "מתחילים מההזמנות ומהמועדון. ה-CRM, הוואטסאפ והדשבורד יושבים באותה מערכת - בלי שילובים שבירים ובלי עוד אפליקציה לצוות.",
    modules: [
      { id: "live", tag: "Live", name: "מנוע ההזמנות", color: "#16A34A", icon: "📅",
        desc: "שיבוץ שולחנות חכם, רשימת המתנה, דשבורד בעלים וווידג׳ט לאתר - בזמן אמת, על כל טאבלט.",
        features: ["שיבוץ אוטומטי לפי גודל קבוצה", "רשימת המתנה עם התאמה חכמה", "ווידג׳ט לאתר בשורת קוד אחת", "תזכורות ודיווחי no-show"] },
      { id: "connect", tag: "Connect", name: "שכבת הקשר עם האורחים", color: "#2563EB", icon: "💬",
        desc: "CRM אורחים, זיהוי לקוחות חוזרים, בוט וואטסאפ AI ונראות לבעלים - בלי עוד אפליקציה.",
        features: ["CRM שנבנה אוטומטית מההזמנה הראשונה", "תגיות VIP, חוזר, בסיכון, מארח גדול", "בוט וואטסאפ בעברית, אנגלית וערבית", "סיכום יומי לבעלים ב-WhatsApp"] },
      { id: "club", tag: "Club", name: "מועדון החברים של המסעדה", color: "#9333EA", icon: "🎟️",
        desc: "נקודות, דרגות VIP והפניות - מועדון שנותן לאורחים סיבה אמיתית לחזור שוב ושוב.",
        features: ["נקודות על ביקורים לפי הכללים שלך", "הטבות יום הולדת ואירועים", "חבר מביא חבר עם תגמול לשניהם", "האורח בודק יתרה בוואטסאפ"] },
    ],
    howTitle: "איך זה עובד",
    howSub: "ארבעה צעדים. אותו לולאה שמייצרת קשר ארוך טווח עם האורח.",
    howSteps: [
      { n: "01", t: "הזמנה נכנסת", d: "דרך וואטסאפ, האתר שלך, או הטלפון - הכל נוחת במקום אחד.", icon: "📥" },
      { n: "02", t: "OpenSeat מאשר", d: "המערכת משבצת שולחן, שולחת אישור וסידור למשמרת.", icon: "✅" },
      { n: "03", t: "מזהים את האורח", d: "הצוות רואה אם זה חבר מועדון, VIP ומה חשוב לפני ההושבה.", icon: "👀" },
      { n: "04", t: "מחזירים אותו שוב", d: "נקודות, הטבה או הודעת חזרה - והקשר עם האורח ממשיך.", icon: "🔁" },
    ],
    whyTitle: "למה מסעדות בוחרות ב-OpenSeat",
    whyPoints: [
      { t: "חוסך 1-2 שעות ביום", d: "פחות טלפונים, פחות הקלדות, פחות בלגן בין וואטסאפ, אתר ונייר.", accent: "time" },
      { t: "משפר את הקשר עם האורחים", d: "היסטוריה, העדפות ורגעים חשובים - במקום אחד. בלי לנחש.", accent: "heart" },
      { t: "מגדיל שימור וחזרות", d: "מועדון, הטבות ותקשורת מדויקת - יותר אורחים חוזרים.", accent: "trend" },
      { t: "וואטסאפ + כל טאבלט", d: "האורחים נשארים בוואטסאפ. הצוות עובד מכל דפדפן.", accent: "chat" },
      { t: "White-label מלא", d: "המיתוג שלך, הווידג׳ט שלך, הדשבורד שלך - לא עוד פלטפורמה גנרית.", accent: "brush" },
      { t: "מחיר נגיש וברור", d: "חבילות חודשיות למסעדות עצמאיות, בלי חומרה יקרה.", accent: "coin" },
    ],
    cmpTitle: "השוואה ישירה", cmpSub: "מה באמת יש לכל מערכת - לא מה שהאתר מבטיח.",
    cmpHeaders: ["", "OpenSeat", "Ontopo", "Tabit", "SevenRooms"],
    cmpRows: [
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
    launchTitle: "מחיר השקה לפיילוט", launchKicker: "5 מסעדות ראשונות",
    launchDesc: "חבילת Growth המלאה ב-₪299/חודש ל-5 המסעדות הראשונות. מחיר חודשי קבוע לפיילוט, לא תשלום חד-פעמי.",
    launchCta: "הבטיחו את המקום שלכם", launchNote: "אחרי 5 המקומות - מחירון Growth הרגיל",
    pricingTitle: "מחירון שקוף",
    pricingSub: "חבילות חודשיות לפי גודל המסעדה. הנחה שנתית (10 חודשים במחיר של 12). ביטול מתי שרוצים.",
    pricingTierLabel: "בחר גודל מסעדה",
    tiers: [
      { id: "80", label: "עד 80 מושבים" }, { id: "150", label: "עד 150" },
      { id: "200", label: "עד 200" }, { id: "200+", label: "200+" },
    ],
    plans: [
      { name: "Live", desc: "הזמנות + ווידג׳ט + דשבורד", module: "OpenSeat Live",
        prices: { "80": 499, "150": 699, "200": 999, "200+": 1399 } as Record<string, number>,
        includes: ["מנוע הזמנות חכם", "רשימת המתנה", "ווידג׳ט לאתר", "דשבורד בעלים"] },
      { name: "Growth", desc: "Live + Connect + Club", module: "OpenSeat Live + Connect + Club", popular: true,
        prices: { "80": 799, "150": 1099, "200": 1499, "200+": 1999 } as Record<string, number>,
        includes: ["הכל ב-Live", "CRM אורחים מלא", "בוט וואטסאפ AI", "מועדון חברים + הטבות"] },
    ],
    addonsTitle: "תוספות אופציונליות", addonsSub: "הוסף רק מה שאתה צריך. בלי חבילות חובה.",
    addons: [
      { t: "הדרכות עובדים", p: "₪29/חודש", d: "הדרכות צוות, נהלי שירות והכשרה שוטפת." },
      { t: "ניהול ספקים", p: "₪39/חודש", d: "ספקים, הזמנות רכש ותיאום תפעולי." },
      { t: "ניהול מלאי", p: "₪39/חודש", d: "מלאי, חוסרים ותזכורות מטבח/בר." },
      { t: "ניהול תפריט", p: "₪19/חודש", d: "עדכון מנות, מחירים וזמינות ממקום אחד." },
      { t: "דשבורד אנליטיקס", p: "₪19/חודש", d: "ביצועים, שימור ושעות עומס." },
    ],
    faqTitle: "שאלות נפוצות",
    faq: [
      { q: "האם צריך ידע טכני?", a: "לא. הווידג׳ט נכנס בשורת קוד, הדשבורד עובד מהדפדפן, ווואטסאפ עובד לבד." },
      { q: "יש הנחה שנתית? אפשר לבטל מתי שרוצים?", a: "בהתחייבות שנתית משלמים 10 חודשים ומקבלים 12. במסלול חודשי אפשר לבטל בכל עת." },
      { q: "זה עובד על הטאבלט שכבר יש לי?", a: "כן. כל המערכת בדפדפן - על כל טאבלט או מחשב רגיל." },
      { q: "אפשר לשים את המיתוג של המסעדה?", a: "כן. הווידג׳ט, הדשבורד והחוויה נבנים סביב המותג שלך." },
      { q: "באילו שפות המערכת עובדת?", a: "עברית, אנגלית וערבית, עם זיהוי שפה אוטומטי לאורח." },
      { q: "הנתונים שלי באמת שלי?", a: "כן. אתה הבעלים של כל נתוני האורחים וה-CRM." },
    ],
    demoTitle: "דמו הזמנה חי",
    demoSub: "כך נראה תהליך ההזמנה באתר שלך - מהיר, נקי ועובד על כל טאבלט.",
    contactTitle: "דברו איתנו",
    contactSub: "שיחה של 15 דקות. מקבלים דמו חי על המסעדה שלך בוואטסאפ.",
    contactLeft: [
      { t: "15 דקות, בלי בלבולים", d: "שיחה קצרה, תשובות אמיתיות." },
      { t: "התסריטים שלך, לא שלנו", d: "ספר על המסעדה ונראה לך תוצאות רלוונטיות." },
      { t: "הדגמה חיה בוואטסאפ", d: "ראה בדיוק מה האורחים שלך יחוו." },
    ],
    footer: {
      tagline: "חבר הצוות הכי חכם של המסעדה שלך.",
      cols: [
        { t: "מוצר", items: ["OpenSeat Live", "OpenSeat Connect", "OpenSeat Club", "תוספות", "מחירון"] },
        { t: "חברה", items: ["מי אנחנו", "פיילוט", "בלוג", "צור קשר"] },
        { t: "משאבים", items: ["מרכז עזרה", "מדריך הקמה", "סטטוס מערכת", "תנאי שימוש", "פרטיות"] },
      ],
      contact: "milhemsione@gmail.com",
      rights: "OpenSeat \u00A9 2026 \u00B7 נבנה באהבה בראש העין",
    },
    widget: {
      title: "הזמנת שולחן", restaurant: "BFF Ra'anana", subtitle: "פתוח · מוכן לאורחים",
      dateLabel: "מתי?", partyLabel: "לכמה אנשים?", timeLabel: "בחר שעה",
      seatingLabel: "איזור ישיבה", seating: { indoor: "פנים", outdoor: "חוץ", bar: "בר" },
      nameLabel: "שם", phoneLabel: "טלפון", phoneHint: "לאישור בוואטסאפ",
      submit: "אשר הזמנה", submitted: "נשלח ✓", confirmedTitle: "ההזמנה התקבלה",
      confirmedSub: "אישור יישלח לוואטסאפ שלך תוך רגע", confirmedAnother: "הזמן עוד שולחן",
      back: "חזרה", continue: "המשך",
    },
    steps: ["תאריך", "שעה", "פרטים", "אישור"],
    monthlyLabel: "חודשי", annualLabel: "שנתי",
    annualNote: "בחיוב שנתי · 10 חודשים בשנה", monthlyNote: "ביטול מתי שרוצים",
    perMonth: "חודש", startWith: (n: string) => `התחל עם ${n}`,
    mostPopular: "הכי פופולרי", pilotLabel: "פיילוט",
    pilotPrice: "לחודש · 5 ראשונות", everythingIncluded: "הכל כולל",
    eyebrows: { system: "המערכת", loop: "הלולאה", value: "הערך", compare: "השוואה", pricing: "מחירון", demo: "הדגמה חיה", talk: "בוא נדבר" },
    allSystems: "כל המערכות פעילות",
    guests: "סועדים",
    autoAssign: "המערכת שיבצה אוטומטית שולחן לפי הגודל",
    loopingDemo: "הדגמה חוזרת", paused: "עצור על hover",
    waConfirm: "היי דני! שולחן ל-4 בשעה 20:00 ביום שישי. נתראה! 🌿",
    dateFull: "שישי, 24.4", dateRelative: "היום + 4 ימים",
    demoName: "דני ל.",
    repeatGuests: "אורחים חוזרים", waAutoConfirm: "WhatsApp · אישור אוטומטי", aiTyping: "AI מקליד תשובה",
    embedLabel: "רץ עכשיו באתר שלך",
    embedNote: "זה הווידג׳ט האמיתי, לא תמונה ולא קישור. האורח מזמין כאן וההזמנה נכנסת ישר למערכת.",
    widgetLoading: "טוען את הווידג׳ט החי...",
    widgetError: "הווידג׳ט לא נטען כרגע.",
    formName: "שם מלא", formEmail: "Email", formRestaurant: "שם המסעדה",
    formPhone: "טלפון", formSeats: "גודל מסעדה", formSend: "שלח בקשה", formSending: "...", formSent: "נשלח ✓",
    cmpLegend: { yes: "יש", partial: "חלקי", no: "אין" },
  },
  en: {
    dir: "ltr" as const, code: "EN",
    nav: { modules: "Modules", how: "How it works", pricing: "Pricing", demo: "Live demo", contact: "Contact", cta: "Talk to us" },
    hero: {
      badge: "Pilot \u00B7 First 5 restaurants \u00B7 \u20AA299/mo",
      title1: "Your restaurant's", title2: "smartest", title3: "team member.",
      desc: "Reservations + membership club on WhatsApp. OpenSeat gives restaurants bookings, guest relationships and their own white-label dashboard - one system that runs on your site and any tablet.",
      cta1: "See live demo", cta2: "See pricing",
      trust: "Works 24/7 \u00B7 AI powered \u00B7 Hebrew, English, Arabic",
    },
    tape: ["Online reservations", "WhatsApp AI bot", "Membership club", "Guest CRM", "Website widget", "Owner dashboard"],
    stats: [
      { k: "24/7", v: "AI on, never sleeps" },
      { k: "1-2 hrs", v: "saved every shift" },
      { k: "3\u00D7", v: "more repeat guests" },
      { k: "100%", v: "your brand, your site" },
    ],
    modulesTitle: "Three modules.", modulesTitle2: "One complete system.",
    modulesSub: "Start with reservations and a membership club. Guest CRM, WhatsApp and the owner dashboard live in the same system - no brittle integrations, no second app for staff.",
    modules: [
      { id: "live", tag: "Live", name: "Reservations engine", color: "#16A34A", icon: "📅",
        desc: "Smart table assignment, waitlist, owner dashboard and website widget - real-time, any tablet.",
        features: ["Auto table assignment by party size", "Waitlist with smart matching", "One-line embed widget", "Reminders & no-show tracking"] },
      { id: "connect", tag: "Connect", name: "Guest relationship layer", color: "#2563EB", icon: "💬",
        desc: "Guest CRM, repeat recognition, WhatsApp AI and owner visibility - no second app.",
        features: ["CRM auto-built from first booking", "Auto tags: VIP, returning, at-risk", "WhatsApp bot in HE / EN / AR", "Daily owner summary on WhatsApp"] },
      { id: "club", tag: "Club", name: "Membership club layer", color: "#9333EA", icon: "🎟️",
        desc: "Points, VIP tiers and referrals - a real reason for guests to come back.",
        features: ["Points on visits by your rules", "Birthday & milestone perks", "Member-get-member referrals", "Balance check on WhatsApp"] },
    ],
    howTitle: "How it works",
    howSub: "Four steps. One loop that builds a long-term relationship with every guest.",
    howSteps: [
      { n: "01", t: "Reservation comes in", d: "WhatsApp, your site or phone - it all lands in one place.", icon: "📥" },
      { n: "02", t: "OpenSeat confirms", d: "Assigns a table, sends confirmation, calms the shift.", icon: "✅" },
      { n: "03", t: "Guest is recognized", d: "Staff sees member/VIP status and what matters before seating.", icon: "👀" },
      { n: "04", t: "You bring them back", d: "Points, perks or a comeback message keep the relationship moving.", icon: "🔁" },
    ],
    whyTitle: "Why restaurants pick OpenSeat",
    whyPoints: [
      { t: "Save 1-2 hours a day", d: "Fewer calls, less typing, no chaos between WhatsApp, site and paper.", accent: "time" },
      { t: "Better guest relationships", d: "History, preferences and key moments - one place. No guessing.", accent: "heart" },
      { t: "Higher retention", d: "Membership, perks and precise follow-up bring more guests back.", accent: "trend" },
      { t: "WhatsApp + any tablet", d: "Guests stay on WhatsApp. Staff works from any browser.", accent: "chat" },
      { t: "Full white-label", d: "Your brand, widget and dashboard - not another generic platform.", accent: "brush" },
      { t: "Clear monthly pricing", d: "Built for independents. No expensive hardware, no enterprise bloat.", accent: "coin" },
    ],
    cmpTitle: "Side-by-side", cmpSub: "What each system actually has - not what the landing page promises.",
    cmpHeaders: ["", "OpenSeat", "Ontopo", "Tabit", "SevenRooms"],
    cmpRows: [
      ["Online reservations", "v", "v", "v", "v"],
      ["WhatsApp AI bot", "v", "x", "x", "x"],
      ["Guest CRM", "v", "x", "~", "v"],
      ["Membership club", "v", "x", "x", "~"],
      ["Website widget", "v", "x", "v", "v"],
      ["Owner dashboard", "v", "~", "v", "v"],
      ["White-label", "v", "x", "~", "~"],
      ["Data ownership", "v", "x", "~", "~"],
      ["Standard price", "from \u20AA499", "Free", "\u20AA800+", "$500+"],
    ],
    launchTitle: "Pilot launch price", launchKicker: "First 5 restaurants",
    launchDesc: "Full Growth package at \u20AA299/mo for the first 5 restaurants. Monthly launch price, not a one-time payment.",
    launchCta: "Reserve your slot", launchNote: "After the first 5 - standard Growth pricing",
    pricingTitle: "Transparent pricing",
    pricingSub: "Monthly plans by restaurant size. Annual discount (10 months for 12). Cancel anytime.",
    pricingTierLabel: "Pick your size",
    tiers: [
      { id: "80", label: "Up to 80 seats" }, { id: "150", label: "Up to 150" },
      { id: "200", label: "Up to 200" }, { id: "200+", label: "200+" },
    ],
    plans: [
      { name: "Live", desc: "Reservations + Widget + Dashboard", module: "OpenSeat Live",
        prices: { "80": 499, "150": 699, "200": 999, "200+": 1399 } as Record<string, number>,
        includes: ["Smart reservations engine", "Waitlist", "Website widget", "Owner dashboard"] },
      { name: "Growth", desc: "Live + Connect + Club", module: "OpenSeat Live + Connect + Club", popular: true,
        prices: { "80": 799, "150": 1099, "200": 1499, "200+": 1999 } as Record<string, number>,
        includes: ["Everything in Live", "Full guest CRM", "WhatsApp AI bot", "Membership club + perks"] },
    ],
    addonsTitle: "Optional add-ons", addonsSub: "Add only what you need. No mandatory bundles.",
    addons: [
      { t: "Employee training", p: "\u20AA29/mo", d: "Staff training, service standards, onboarding." },
      { t: "Supplier management", p: "\u20AA39/mo", d: "Suppliers, purchase flow, ops coordination." },
      { t: "Inventory management", p: "\u20AA39/mo", d: "Stock, shortages, kitchen/bar reminders." },
      { t: "Menu management", p: "\u20AA19/mo", d: "Update dishes, pricing and availability." },
      { t: "Analytics dashboard", p: "\u20AA19/mo", d: "Performance, retention and peak hours." },
    ],
    faqTitle: "Frequently asked",
    faq: [
      { q: "Do I need technical knowledge?", a: "No. The widget embeds in one line, the dashboard runs in the browser, WhatsApp works on its own." },
      { q: "Annual discount? Can I cancel anytime?", a: "Annual plans give 12 months for the price of 10. Monthly plans can be cancelled anytime." },
      { q: "Will it run on my existing tablet?", a: "Yes. Browser-based - any normal tablet or computer works." },
      { q: "Can I use my own branding?", a: "Yes. Widget, dashboard and guest experience all carry your brand." },
      { q: "Which languages does it support?", a: "Hebrew, English and Arabic, with auto-detection for guests." },
      { q: "Do I really own my data?", a: "Yes. You own the guest data and CRM fully." },
    ],
    demoTitle: "Live booking demo",
    demoSub: "This is what booking looks like on your site - fast, clean, made for real guests.",
    contactTitle: "Talk to us",
    contactSub: "A 15-minute call. Get a live WhatsApp demo for your own restaurant.",
    contactLeft: [
      { t: "15 minutes, no fluff", d: "Quick call, real answers." },
      { t: "Your scenarios, not ours", d: "Tell us about your restaurant, we'll show relevant results." },
      { t: "Live WhatsApp walkthrough", d: "See exactly what your guests will experience." },
    ],
    footer: {
      tagline: "Your restaurant's smartest team member.",
      cols: [
        { t: "Product", items: ["OpenSeat Live", "OpenSeat Connect", "OpenSeat Club", "Add-ons", "Pricing"] },
        { t: "Company", items: ["About", "Pilot", "Blog", "Contact"] },
        { t: "Resources", items: ["Help center", "Setup guide", "Status", "Terms", "Privacy"] },
      ],
      contact: "milhemsione@gmail.com",
      rights: "OpenSeat \u00A9 2026 \u00B7 Built with love in Rosh HaAyin",
    },
    widget: {
      title: "Reserve a table", restaurant: "BFF Ra'anana", subtitle: "Open \u00B7 Ready for guests",
      dateLabel: "When?", partyLabel: "How many?", timeLabel: "Pick a time",
      seatingLabel: "Seating", seating: { indoor: "Indoor", outdoor: "Outdoor", bar: "Bar" },
      nameLabel: "Name", phoneLabel: "Phone", phoneHint: "For WhatsApp confirmation",
      submit: "Confirm reservation", submitted: "Sent \u2713", confirmedTitle: "Reservation confirmed",
      confirmedSub: "A confirmation is on its way to your WhatsApp", confirmedAnother: "Book another table",
      back: "Back", continue: "Continue",
    },
    steps: ["Date", "Time", "Details", "Confirm"],
    monthlyLabel: "Monthly", annualLabel: "Annual",
    annualNote: "Billed annually \u00B7 10 months", monthlyNote: "Cancel anytime",
    perMonth: "mo", startWith: (n: string) => `Start with ${n}`,
    mostPopular: "MOST POPULAR", pilotLabel: "Pilot",
    pilotPrice: "per month \u00B7 first 5", everythingIncluded: "Everything included",
    eyebrows: { system: "The system", loop: "The loop", value: "The value", compare: "Compare", pricing: "Pricing", demo: "Live demo", talk: "Let's talk" },
    allSystems: "All systems operational",
    guests: "guests",
    autoAssign: "Auto-assigned a table by party size",
    loopingDemo: "looping demo", paused: "paused",
    waConfirm: "Hi Danny! Table for 4 at 20:00 Fri. See you! 🌿",
    dateFull: "Fri, Apr 24", dateRelative: "Today + 4 days",
    demoName: "Danny L.",
    repeatGuests: "repeat guests", waAutoConfirm: "WhatsApp \u00B7 auto-confirm", aiTyping: "AI typing\u2026",
    embedLabel: "RUNNING LIVE ON YOUR SITE",
    embedNote: "This is the real widget, not a screenshot and not a link. Guests book here and the reservation goes straight into the system.",
    widgetLoading: "Loading the live widget...",
    widgetError: "The widget could not load right now.",
    formName: "Full name", formEmail: "Email", formRestaurant: "Restaurant",
    formPhone: "Phone", formSeats: "Seats", formSend: "Send request", formSending: "...", formSent: "Sent \u2713",
    cmpLegend: { yes: "Included", partial: "Partial", no: "Missing" },
  },
  ar: {
    dir: "rtl" as const, code: "AR",
    nav: { modules: "الوحدات", how: "كيف يعمل", pricing: "الأسعار", demo: "عرض حي", contact: "تواصل", cta: "تحدث معنا" },
    hero: {
      badge: "بايلوت · أول 5 مطاعم · ₪299/شهر",
      title1: "أذكى عضو", title2: "في فريق", title3: "مطعمك.",
      desc: "حجوزات + نادي أعضاء على واتساب. OpenSeat يجمع الحجوزات، العلاقة مع الضيوف، ولوحة المالك - نظام واحد على موقعك وعلى أي تابلت.",
      cta1: "شاهد العرض الحي", cta2: "شاهد الأسعار",
      trust: "يعمل 24/7 · مدعوم بالذكاء الاصطناعي · عربي، عبري، إنجليزي",
    },
    tape: ["حجوزات أونلاين", "بوت واتساب AI", "نادي أعضاء", "CRM ضيوف", "ودجة للموقع", "لوحة مالك"],
    stats: [
      { k: "24/7", v: "AI نشط بدون توقف" },
      { k: "1-2 ساعة", v: "توفير في كل وردية" },
      { k: "3\u00D7", v: "زيارات متكررة أكثر" },
      { k: "100%", v: "علامتك وموقعك يبقيان لك" },
    ],
    modulesTitle: "ثلاث وحدات.", modulesTitle2: "نظام متكامل واحد.",
    modulesSub: "ابدأ بالحجوزات ونادي الأعضاء. CRM الضيوف، واتساب ولوحة المالك في نفس النظام - بدون تكاملات هشّة وبدون تطبيق إضافي.",
    modules: [
      { id: "live", tag: "Live", name: "محرك الحجوزات", color: "#16A34A", icon: "📅",
        desc: "تعيين طاولات ذكي، قائمة انتظار، لوحة مالك وودجة للموقع - لحظي وعلى أي تابلت.",
        features: ["تعيين تلقائي حسب حجم المجموعة", "قائمة انتظار بمطابقة ذكية", "ودجة بسطر كود واحد", "تذكيرات وتتبع عدم الحضور"] },
      { id: "connect", tag: "Connect", name: "طبقة العلاقة مع الضيوف", color: "#2563EB", icon: "💬",
        desc: "CRM ضيوف، معرفة الزبون العائد، واتساب AI ورؤية للمالك - بدون تطبيق ثانٍ.",
        features: ["CRM يُبنى تلقائيًا", "وسوم VIP، عائد، معرض للخطر", "واتساب AI بـ 3 لغات", "ملخص يومي للمالك على واتساب"] },
      { id: "club", tag: "Club", name: "نادي الأعضاء", color: "#9333EA", icon: "🎟️",
        desc: "نقاط، درجات VIP وإحالات - سبب حقيقي ليعود الضيف.",
        features: ["نقاط على الزيارات", "امتيازات عيد الميلاد", "عضو يجلب عضو", "فحص الرصيد على واتساب"] },
    ],
    howTitle: "كيف يعمل",
    howSub: "أربع خطوات. حلقة واحدة تبني علاقة طويلة مع كل ضيف.",
    howSteps: [
      { n: "01", t: "الحجز يدخل", d: "واتساب، موقعك أو الهاتف - كله يدخل لمكان واحد.", icon: "📥" },
      { n: "02", t: "OpenSeat يؤكد", d: "يعيّن الطاولة، يرسل التأكيد ويهدئ الوردية.", icon: "✅" },
      { n: "03", t: "تتعرف على الضيف", d: "الطاقم يرى حالة العضو/VIP وما المهم قبل الجلوس.", icon: "👀" },
      { n: "04", t: "تعيده مرة أخرى", d: "نقاط، امتيازات أو رسالة عودة تواصل العلاقة.", icon: "🔁" },
    ],
    whyTitle: "لماذا يختار المطاعم OpenSeat",
    whyPoints: [
      { t: "يوفّر 1-2 ساعة يوميًا", d: "مكالمات أقل، طباعة أقل، فوضى أقل بين واتساب والموقع والورق.", accent: "time" },
      { t: "علاقة أفضل مع الضيوف", d: "التاريخ والتفضيلات واللحظات المهمة - مكان واحد.", accent: "heart" },
      { t: "احتفاظ أعلى", d: "العضوية والمكافآت والمتابعة تعيد المزيد من الضيوف.", accent: "trend" },
      { t: "واتساب + أي تابلت", d: "الضيوف على واتساب، والطاقم من أي متصفح.", accent: "chat" },
      { t: "White-label كامل", d: "علامتك، ودجتك ولوحة التحكم الخاصة بك.", accent: "brush" },
      { t: "تسعير شهري واضح", d: "مبني للمستقلين. بدون أجهزة باهظة.", accent: "coin" },
    ],
    cmpTitle: "مقارنة مباشرة", cmpSub: "ما يوجد فعلاً في كل نظام.",
    cmpHeaders: ["", "OpenSeat", "Ontopo", "Tabit", "SevenRooms"],
    cmpRows: [
      ["حجوزات أونلاين", "v", "v", "v", "v"],
      ["بوت واتساب AI", "v", "x", "x", "x"],
      ["CRM ضيوف", "v", "x", "~", "v"],
      ["نادي أعضاء", "v", "x", "x", "~"],
      ["ودجة موقع", "v", "x", "v", "v"],
      ["لوحة مالك", "v", "~", "v", "v"],
      ["White-label", "v", "x", "~", "~"],
      ["ملكية البيانات", "v", "x", "~", "~"],
      ["السعر العادي", "من ₪499", "مجاني", "₪800+", "$500+"],
    ],
    launchTitle: "سعر إطلاق البايلوت", launchKicker: "أول 5 مطاعم",
    launchDesc: "حزمة Growth الكاملة بـ ₪299/شهر لأول 5 مطاعم. سعر شهري للإطلاق.",
    launchCta: "احجز مكانك", launchNote: "بعد أول 5 - يعود السعر الاعتيادي لـ Growth",
    pricingTitle: "تسعير شفاف",
    pricingSub: "خطط شهرية حسب حجم المطعم. خصم سنوي (10 بسعر 12). إلغاء في أي وقت.",
    pricingTierLabel: "اختر الحجم",
    tiers: [
      { id: "80", label: "حتى 80 مقعد" }, { id: "150", label: "حتى 150" },
      { id: "200", label: "حتى 200" }, { id: "200+", label: "200+" },
    ],
    plans: [
      { name: "Live", desc: "حجوزات + ودجة + لوحة", module: "OpenSeat Live",
        prices: { "80": 499, "150": 699, "200": 999, "200+": 1399 } as Record<string, number>,
        includes: ["محرك حجوزات ذكي", "قائمة انتظار", "ودجة للموقع", "لوحة مالك"] },
      { name: "Growth", desc: "Live + Connect + Club", module: "OpenSeat Live + Connect + Club", popular: true,
        prices: { "80": 799, "150": 1099, "200": 1499, "200+": 1999 } as Record<string, number>,
        includes: ["كل ما في Live", "CRM ضيوف كامل", "بوت واتساب AI", "نادي أعضاء + امتيازات"] },
    ],
    addonsTitle: "إضافات اختيارية", addonsSub: "أضف فقط ما تحتاج. بدون باقات إلزامية.",
    addons: [
      { t: "تدريب الموظفين", p: "₪29/شهر", d: "تدريب الطاقم ومعايير الخدمة." },
      { t: "إدارة الموردين", p: "₪39/شهر", d: "موردون وطلبات شراء وتنسيق." },
      { t: "إدارة المخزون", p: "₪39/شهر", d: "مخزون، نواقص وتذكيرات." },
      { t: "إدارة القائمة", p: "₪19/شهر", d: "تحديث الأطباق والأسعار." },
      { t: "لوحة تحليلات", p: "₪19/شهر", d: "الأداء والاحتفاظ وساعات الذروة." },
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "هل أحتاج معرفة تقنية؟", a: "لا. الودجة بسطر واحد، لوحة التحكم في المتصفح، وواتساب يعمل وحده." },
      { q: "هل يوجد خصم سنوي وإمكانية إلغاء؟", a: "12 شهر بسعر 10 سنويًا. الإلغاء ممكن أي وقت في الخطة الشهرية." },
      { q: "هل يعمل على تابلتي؟", a: "نعم -النظام كله في المتصفح." },
      { q: "هل أستخدم علامتي؟", a: "نعم. الودجة، اللوحة وتجربة الضيف تحمل علامتك." },
      { q: "ما اللغات المدعومة؟", a: "عربي، عبري وإنجليزي مع كشف تلقائي." },
      { q: "هل بياناتي ملكي فعلًا؟", a: "نعم، أنت تملك بيانات الضيوف وCRM." },
    ],
    demoTitle: "عرض حجز حي",
    demoSub: "هكذا يبدو الحجز على موقعك -سريع، نظيف ومصمم لضيوف حقيقيين.",
    contactTitle: "تحدث معنا",
    contactSub: "مكالمة 15 دقيقة. واحصل على عرض حي على واتساب لمطعمك.",
    contactLeft: [
      { t: "15 دقيقة بدون تعقيد", d: "مكالمة قصيرة، إجابات حقيقية." },
      { t: "سيناريوهاتك، ليس سيناريوهاتنا", d: "أخبرنا عن مطعمك وسنعرض لك نتائج." },
      { t: "عرض حي على واتساب", d: "شاهد بالضبط ما سيختبره ضيوفك." },
    ],
    footer: {
      tagline: "أذكى عضو في فريق مطعمك.",
      cols: [
        { t: "المنتج", items: ["OpenSeat Live", "OpenSeat Connect", "OpenSeat Club", "إضافات", "الأسعار"] },
        { t: "الشركة", items: ["من نحن", "البايلوت", "المدونة", "تواصل"] },
        { t: "الموارد", items: ["مركز المساعدة", "دليل الإعداد", "حالة النظام", "الشروط", "الخصوصية"] },
      ],
      contact: "milhemsione@gmail.com",
      rights: "OpenSeat \u00A9 2026 \u00B7 مبني بحب في رأس العين",
    },
    widget: {
      title: "احجز طاولة", restaurant: "BFF رعنانا", subtitle: "مفتوح · جاهز للضيوف",
      dateLabel: "متى؟", partyLabel: "لكم شخص؟", timeLabel: "اختر وقت",
      seatingLabel: "منطقة الجلوس", seating: { indoor: "داخلي", outdoor: "خارجي", bar: "بار" },
      nameLabel: "الاسم", phoneLabel: "الهاتف", phoneHint: "للتأكيد على واتساب",
      submit: "أكد الحجز", submitted: "أُرسل ✓", confirmedTitle: "تم تأكيد الحجز",
      confirmedSub: "التأكيد في طريقه إلى واتساب", confirmedAnother: "احجز طاولة أخرى",
      back: "رجوع", continue: "متابعة",
    },
    steps: ["التاريخ", "الوقت", "التفاصيل", "تأكيد"],
    monthlyLabel: "شهري", annualLabel: "سنوي",
    annualNote: "فوترة سنوية · 10 أشهر", monthlyNote: "إلغاء متى ما شئت",
    perMonth: "شهر", startWith: (n: string) => `ابدأ مع ${n}`,
    mostPopular: "الأكثر شعبية", pilotLabel: "بايلوت",
    pilotPrice: "شهريًا · أول 5", everythingIncluded: "كل شيء مشمول",
    eyebrows: { system: "النظام", loop: "الحلقة", value: "القيمة", compare: "مقارنة", pricing: "الأسعار", demo: "عرض حي", talk: "تواصل" },
    allSystems: "كل الأنظمة تعمل",
    guests: "ضيوف",
    autoAssign: "تم تعيين طاولة تلقائيًا حسب الحجم",
    loopingDemo: "عرض متكرر", paused: "paused",
    waConfirm: "أهلًا دني! طاولة لـ 4 في 20:00 يوم الجمعة.",
    dateFull: "الجمعة 24.4", dateRelative: "اليوم + 4 أيام",
    demoName: "دني ل.",
    repeatGuests: "عائدون", waAutoConfirm: "واتساب · تأكيد تلقائي", aiTyping: "AI يكتب...",
    embedLabel: "يعمل الآن على موقعك",
    embedNote: "هذه هي الودجة الحقيقية، ليست صورة ولا رابطًا. الضيف يحجز هنا والحجز يدخل مباشرة إلى النظام.",
    widgetLoading: "يتم تحميل الودجة الحية...",
    widgetError: "تعذر تحميل الودجة الآن.",
    formName: "الاسم", formEmail: "البريد الإلكتروني", formRestaurant: "اسم المطعم",
    formPhone: "هاتف", formSeats: "حجم المطعم", formSend: "أرسل", formSending: "...", formSent: "أُرسل ✓",
    cmpLegend: { yes: "موجود", partial: "جزئي", no: "غير موجود" },
  },
};

type I18NData = (typeof I18N)[Lang];

type OpenSeatBookingWindow = Window & typeof globalThis & {
  OpenSeatBooking?: {
    mount: (el: HTMLElement, config: { restaurantId: string; apiUrl?: string }) => void;
  };
};

const LIVE_WIDGET_RESTAURANT_ID = "c3c22e37-a309-4fde-aa6c-6e714212a3bc";
const LIVE_WIDGET_API_URL = "https://booking-widget-rust.vercel.app";
const LIVE_WIDGET_SCRIPT_URL = `${LIVE_WIDGET_API_URL}/openseat-booking.iife.js`;

let liveWidgetScriptPromise: Promise<void> | null = null;

function ensureLiveWidgetScript() {
  const widgetWindow = window as OpenSeatBookingWindow;
  if (widgetWindow.OpenSeatBooking) return Promise.resolve();

  if (!liveWidgetScriptPromise) {
    liveWidgetScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-openseat-live-widget="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load OpenSeat widget script")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = LIVE_WIDGET_SCRIPT_URL;
      script.async = true;
      script.dataset.openseatLiveWidget = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load OpenSeat widget script"));
      document.body.appendChild(script);
    });
  }

  return liveWidgetScriptPromise;
}

/* ═══════════════════════════════════════════════════════════
   Hooks
   ═══════════════════════════════════════════════════════════ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ═══════════════════════════════════════════════════════════
   Shared components
   ═══════════════════════════════════════════════════════════ */
function Logo({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--brand)" />
        <path d="M9 21c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6v1H9v-1z" fill="white" />
        <circle cx="16" cy="11" r="3.5" fill="white" />
      </svg>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>OpenSeat</span>
    </div>
  );
}

function WhyIcon({ k }: { k: string }) {
  const common: Record<string, unknown> = { width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (k) {
    case "time": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "heart": return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case "trend": return <svg {...common}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
    case "chat": return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" /></svg>;
    case "brush": return <svg {...common}><path d="M19 4l-8 8" /><path d="M15 3h6v6" /><path d="M4 20s1-4 4-4 4 4 4 4" /></svg>;
    case "coin": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M14 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-4" /><path d="M12 7v2M12 15v2" /></svg>;
    default: return null;
  }
}

function CmpCell({ v }: { v: string }) {
  if (v === "v") return <span className="cmp-check yes">{"\u2713"}</span>;
  if (v === "x") return <span className="cmp-check no">{"\u2715"}</span>;
  if (v === "~") return <span className="cmp-check partial">~</span>;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>{v}</span>;
}

/* ═══════════════════════════════════════════════════════════
   Accessibility Widget (preserved from original)
   ═══════════════════════════════════════════════════════════ */
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
      if (raw) { const p = JSON.parse(raw); const s = { fontScale: Math.min(1.3, Math.max(0.9, Number(p.fontScale ?? 1))), contrast: !!p.contrast, links: !!p.links, readableFont: !!p.readableFont, reducedMotion: !!p.reducedMotion }; setSettings(s); applyA11y(s); }
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
    setSettings(next); applyA11y(next);
    try {
      const isDefault = next.fontScale === 1 && !next.contrast && !next.links && !next.readableFont && !next.reducedMotion;
      if (isDefault) localStorage.removeItem(a11yStorageKey);
      else localStorage.setItem(a11yStorageKey, JSON.stringify(next));
    } catch { /* ignore */ }
  };
  const isRtl = lang !== "en";
  return (
    <div style={{ position: "fixed", bottom: 16, [isRtl ? "left" : "right"]: 16, zIndex: 100 }}>
      {open && (
        <div style={{ position: "absolute", bottom: "100%", [isRtl ? "left" : "right"]: 0, marginBottom: 12, width: "min(22rem,calc(100vw - 2rem))", borderRadius: 16, border: "1px solid var(--line)", background: "rgba(255,255,255,.95)", padding: 16, boxShadow: "0 24px 60px -24px rgba(0,0,0,.25)", backdropFilter: "blur(12px)" }}
          role="dialog" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{copy.title}</h2>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-50)", fontSize: 13 }}>{copy.close}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--paper-2)", padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{copy.textSize}</p>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ label: copy.decrease, fn: () => update({ ...settings, fontScale: Math.max(0.9, settings.fontScale - 0.1) }) },
                  { label: copy.resetSize, fn: () => update({ ...settings, fontScale: 1 }) },
                  { label: copy.increase, fn: () => update({ ...settings, fontScale: Math.min(1.3, settings.fontScale + 0.1) }) },
                ].map((b) => (
                  <button key={b.label} onClick={b.fn} style={{ minWidth: "4.5rem", borderRadius: 8, border: "1px solid var(--line)", background: "white", padding: "8px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{b.label}</button>
                ))}
              </div>
            </div>
            {(["contrast", "links", "readableFont", "reducedMotion"] as const).map((key, i) => {
              const labels = [copy.contrast, copy.linksLabel, copy.readable, copy.motion];
              return (
                <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid var(--line)", background: "var(--paper-2)", padding: "12px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  <span>{labels[i]}</span>
                  <input type="checkbox" checked={settings[key] as boolean} onChange={(e) => update({ ...settings, [key]: e.target.checked })} style={{ width: 20, height: 20, accentColor: "var(--brand)" }} />
                </label>
              );
            })}
            <button onClick={() => update(a11yDefaults)} style={{ width: "100%", borderRadius: 8, padding: "12px 16px", fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "white", border: "none", cursor: "pointer" }}>{copy.resetAll}</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={copy.button}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "12px 14px", background: "var(--brand)", color: "white", border: "none", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(196,30,58,.2)", fontSize: 14, fontWeight: 600 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v4.5m0 0l-4.5 1.5m4.5-1.5l4.5 1.5M10 22l2-6 2 6m-6-3h8" />
        </svg>
        <span style={{ display: "none" }} className="a11y-label">{copy.button}</span>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Nav
   ═══════════════════════════════════════════════════════════ */
function Nav({ L, lang, setLang }: { L: I18NData; lang: Lang; setLang: (l: Lang) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const onS = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onS, { passive: true });
    return () => window.removeEventListener("scroll", onS);
  }, []);
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  const navLinks = [
    { href: "#modules", label: L.nav.modules }, { href: "#how", label: L.nav.how },
    { href: "#pricing", label: L.nav.pricing }, { href: "#demo", label: L.nav.demo },
    { href: "#contact", label: L.nav.contact },
  ];
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 80,
      backdropFilter: scrolled ? "blur(12px)" : "none",
      background: scrolled ? "rgba(251,247,244,.85)" : "transparent",
      borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
      transition: "all .25s",
    }}>
      <div className="container-x" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
        <a href="#top" style={{ display: "flex" }}><Logo /></a>
        <nav className="nav-links" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {navLinks.map(l => <a key={l.href} href={l.href} style={{ fontSize: 14, color: "var(--ink-70)", fontWeight: 500 }}>{l.label}</a>)}
        </nav>
        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="lang-switcher" style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--paper-2)", borderRadius: 999, padding: 3, border: "1px solid var(--line)" }}>
            {(["he", "en", "ar"] as const).map(c => (
              <button key={c} onClick={() => setLang(c)} style={{
                border: "none", background: lang === c ? "white" : "transparent",
                color: lang === c ? "var(--ink)" : "var(--ink-50)",
                padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                boxShadow: lang === c ? "0 1px 2px rgba(0,0,0,.08)" : "none",
              }}>{c.toUpperCase()}</button>
            ))}
          </div>
          <a href="#contact" className="btn btn-primary nav-cta" style={{ padding: "10px 16px", fontSize: 14 }}>
            {L.nav.cta} <span className="arrow">{"\u2192"}</span>
          </a>
          {/* Mobile hamburger */}
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label={lang === "he" ? "תפריט" : lang === "ar" ? "القائمة" : "Menu"} aria-expanded={mobileOpen}
            style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 8, color: "var(--ink)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, top: 56, background: "rgba(251,247,244,.98)", backdropFilter: "blur(12px)", zIndex: 79, padding: "24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{ display: "block", padding: "16px 0", fontSize: 18, fontWeight: 600, color: "var(--ink)", borderBottom: "1px solid var(--line)" }}>{l.label}</a>
          ))}
          <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--paper-2)", borderRadius: 999, padding: 3, border: "1px solid var(--line)" }}>
              {(["he", "en", "ar"] as const).map(c => (
                <button key={c} onClick={() => { setLang(c); setMobileOpen(false); }} style={{
                  border: "none", background: lang === c ? "white" : "transparent",
                  color: lang === c ? "var(--ink)" : "var(--ink-50)",
                  padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>{c.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <a href="#contact" onClick={() => setMobileOpen(false)} className="btn btn-primary" style={{ marginTop: 16, justifyContent: "center", width: "100%", padding: "16px 24px", fontSize: 16 }}>
            {L.nav.cta} <span className="arrow">{"\u2192"}</span>
          </a>
        </div>
      )}
      <style>{`
        @media(max-width:900px){
          .nav-links{ display:none !important; }
          .nav-cta{ display:none !important; }
          .mobile-menu-btn{ display:flex !important; }
        }
        @media(max-width:480px){
          .lang-switcher{ display:none !important; }
        }
      `}</style>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   Hero Widget (auto-looping booking demo)
   ═══════════════════════════════════════════════════════════ */
function HeroWidget({ L }: { L: I18NData }) {
  const w = L.widget;
  const [step, setStep] = useState(0);
  const [party, setParty] = useState(2);
  const [time, setTime] = useState("19:30");
  const [seating, setSeating] = useState("indoor");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const seq = [
      { t: 1400, fn: () => setParty(4) },
      { t: 900, fn: () => setStep(1) },
      { t: 1500, fn: () => setTime("20:00") },
      { t: 900, fn: () => setStep(2) },
      { t: 1400, fn: () => setSeating("outdoor") },
      { t: 1200, fn: () => setStep(3) },
      { t: 2800, fn: () => { setStep(0); setParty(2); setTime("19:30"); setSeating("indoor"); } },
    ];
    let i = 0;
    let tid: ReturnType<typeof setTimeout>;
    const run = () => {
      tid = setTimeout(() => { seq[i].fn(); i = (i + 1) % seq.length; run(); }, seq[i].t);
    };
    run();
    return () => clearTimeout(tid);
  }, [auto]);

  const times = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

  return (
    <div style={{ width: "100%", maxWidth: 380, background: "white", borderRadius: 24, border: "1px solid var(--line)", boxShadow: "0 40px 80px -30px rgba(196,30,58,.25), 0 8px 24px -12px rgba(0,0,0,.08)", overflow: "hidden", position: "relative" }}
      onMouseEnter={() => setAuto(false)} onMouseLeave={() => setAuto(true)}>
      {/* Header */}
      <div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#FEE2E2,#FECACA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍽️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{w.restaurant}</div>
            <div style={{ fontSize: 11, color: "var(--ok)", display: "flex", alignItems: "center", gap: 6 }}><span className="live-dot" />{w.subtitle}</div>
          </div>
        </div>
        <div className="mono-sm">{["01", "02", "03", "04"][step]}/04</div>
      </div>
      {/* Progress */}
      <div style={{ display: "flex", gap: 4, padding: "12px 20px 0" }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= step ? "var(--brand)" : "var(--line)", transition: "background .4s" }} />)}
      </div>
      {/* Steps */}
      <div style={{ padding: 20, minHeight: 280 }}>
        {step === 0 && (
          <div key="s0" style={{ animation: "slide-in-up .4s both" }}>
            <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 6 }}>{w.dateLabel}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid var(--brand)", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
              <div><div style={{ fontWeight: 700, fontSize: 16 }}>{L.dateFull}</div><div style={{ fontSize: 11, color: "var(--ink-50)" }}>{L.dateRelative}</div></div>
              <span style={{ fontSize: 20 }}>🗓️</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 6 }}>{w.partyLabel}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4, 5, 6, 7].map(n => (
                <button key={n} onClick={() => setParty(n)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: party === n ? "var(--brand)" : "var(--paper-2)", color: party === n ? "white" : "var(--ink)", border: `1px solid ${party === n ? "var(--brand)" : "var(--line)"}`, fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all .2s" }}>{n}</button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div key="s1" style={{ animation: "slide-in-up .4s both" }}>
            <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 10 }}>{w.timeLabel} · {party} {L.guests}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {times.map(t => (
                <button key={t} onClick={() => setTime(t)} style={{ padding: "12px 0", borderRadius: 10, background: time === t ? "var(--brand)" : "white", color: time === t ? "white" : "var(--ink)", border: `1px solid ${time === t ? "var(--brand)" : "var(--line)"}`, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-mono)" }}>{t}</button>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--brand-50)", borderRadius: 10, fontSize: 12, color: "var(--brand-600)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>{"\u2728"}</span><span>{L.autoAssign}</span>
            </div>
          </div>
        )}
        {step === 2 && (
          <div key="s2" style={{ animation: "slide-in-up .4s both" }}>
            <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 8 }}>{w.seatingLabel}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {([["indoor", "🏠"], ["outdoor", "🌿"], ["bar", "🍷"]] as const).map(([k, ic]) => (
                <button key={k} onClick={() => setSeating(k)} style={{ padding: "14px 8px", borderRadius: 10, background: seating === k ? "var(--brand-50)" : "white", border: `1px solid ${seating === k ? "var(--brand)" : "var(--line)"}`, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{ic}</div>{w.seating[k]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 6 }}>{w.nameLabel}</div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 13, fontFamily: "var(--font-mono)" }}>{L.demoName}<span className="caret" /></div>
            <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 6 }}>{w.phoneLabel} · {w.phoneHint}</div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: "var(--font-mono)" }}>054-123-4567</div>
          </div>
        )}
        {step === 3 && (
          <div key="s3" style={{ animation: "slide-in-up .4s both", textAlign: "center", paddingTop: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: "linear-gradient(135deg,#DCFCE7,#BBF7D0)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, position: "relative", marginBottom: 16 }}>
              {"\u2713"}<span style={{ position: "absolute", inset: -8, borderRadius: 999, border: "2px solid #22C55E", opacity: .3, animation: "pulse-ring 1.6s ease-out infinite" }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{w.confirmedTitle}</div>
            <div style={{ fontSize: 13, color: "var(--ink-70)", marginBottom: 18 }}>{w.confirmedSub}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#DCFCE7", borderRadius: 12, textAlign: "start", animation: "slide-in-up .5s .3s both" }}>
              <div style={{ fontSize: 20 }}>💬</div>
              <div style={{ fontSize: 12, color: "#166534" }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>WhatsApp · {w.restaurant}</div>
                <div>{L.waConfirm}</div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{ padding: "10px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--ink-50)" }}>
        <span className="mono-sm">{auto ? L.loopingDemo : L.paused}</span>
        <span className="mono-sm">powered by OpenSeat</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Hero
   ═══════════════════════════════════════════════════════════ */
function Hero({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section id="top" style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #FBF7F4 0%, #FEF2F2 60%, #FBF7F4 100%)" }} />
        <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle at center, rgba(196,30,58,.22), transparent 70%)", top: -120, insetInlineEnd: -80, animation: "mesh-drift 14s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle at center, rgba(253,186,116,.35), transparent 70%)", bottom: -120, insetInlineStart: -60, animation: "mesh-drift 18s ease-in-out infinite reverse" }} />
        <div className="hero-grid-bg" style={{ position: "absolute", inset: 0 }} />
      </div>
      <div className="container-x" style={{ position: "relative", zIndex: 1, paddingBlock: "72px 96px" }}>
        <div className="hero-cols" style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 48, alignItems: "center" }}>
          <div ref={ref} className="reveal-stagger">
            <div className="chip" style={{ marginBottom: 20, background: "white" }}>
              <span className="live-dot" /> <span style={{ fontWeight: 500 }}>{L.hero.badge}</span>
            </div>
            <h1 className="font-display" style={{ fontSize: "clamp(44px, 6vw, 84px)", lineHeight: 1.02, margin: "0 0 18px", fontWeight: 600, letterSpacing: "-0.03em" }}>
              <span>{L.hero.title1}</span>{" "}
              <span style={{ background: "linear-gradient(90deg, var(--brand), #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontStyle: "italic" }}>{L.hero.title2}</span>{" "}
              <span>{L.hero.title3}</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--ink-70)", maxWidth: 560, margin: "0 0 28px", lineHeight: 1.6 }}>{L.hero.desc}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <a href="#demo" className="btn btn-primary">{L.hero.cta1} <span className="arrow">{"\u2192"}</span></a>
              <a href="#pricing" className="btn btn-secondary">{L.hero.cta2}</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-50)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="9" /></svg>
              {L.hero.trust}
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <HeroWidget L={L} />
            <div className="callout-chip" style={{ top: 24, insetInlineStart: -10, animation: "floaty 5s ease-in-out infinite" }}>
              <span style={{ color: "var(--brand)", fontWeight: 700 }}>+42%</span> {L.repeatGuests}
            </div>
            <div className="callout-chip" style={{ bottom: 70, insetInlineEnd: -18, display: "flex", alignItems: "center", gap: 8, animation: "floaty 6s ease-in-out -2s infinite" }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: "#25D366", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11 }}>💬</span>
              {L.waAutoConfirm}
            </div>
            <div className="callout-chip" style={{ top: "52%", insetInlineEnd: -30, background: "var(--ink)", color: "white", border: "1px solid var(--ink)", animation: "floaty 7s ease-in-out -1s infinite" }}>
              <span className="typing-dot" style={{ background: "var(--brand)" }} />
              <span className="typing-dot" style={{ background: "var(--brand)" }} />
              <span className="typing-dot" style={{ background: "var(--brand)" }} />
              <span style={{ marginInlineStart: 8 }}>{L.aiTyping}</span>
            </div>
          </div>
        </div>
        {/* Stats */}
        <div className="stats-grid" style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          {L.stats.map((s, i) => (
            <div key={i} style={{ padding: "28px 20px", borderInlineEnd: i < 3 ? "1px solid var(--line)" : "none", animation: "count-up .7s both", animationDelay: `${i * 0.08}s` }}>
              <div className="font-display" style={{ fontSize: "clamp(28px,3.5vw,44px)", lineHeight: 1, fontWeight: 700, color: "var(--brand)" }}>{s.k}</div>
              <div style={{ fontSize: 13, color: "var(--ink-70)", marginTop: 8, fontWeight: 500 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media(max-width:960px){ .hero-cols{ grid-template-columns: 1fr !important; } .stats-grid{ grid-template-columns: repeat(2,1fr) !important; } .stats-grid > div:nth-child(2n){ border-inline-end: none !important; } .stats-grid > div:nth-child(-n+2){ border-bottom: 1px solid var(--line); } .callout-chip{ display: none !important; } }
        @media(max-width:520px){ .stats-grid{ grid-template-columns: 1fr !important; } .stats-grid > div{ border-inline-end: none !important; border-bottom: 1px solid var(--line); } }
        @media(max-width:480px){ .hero-cols h1{ font-size: clamp(32px, 8vw, 44px) !important; } }
      `}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tape Marquee
   ═══════════════════════════════════════════════════════════ */
function Tape({ L }: { L: I18NData }) {
  const items = [...L.tape, ...L.tape];
  return (
    <div className="tape">
      <div className="tape-inner marquee">
        {items.map((it, i) => <span key={i} className="tape-item"><span className="tape-sep" />{it}</span>)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Modules
   ═══════════════════════════════════════════════════════════ */
function Modules({ L }: { L: I18NData }) {
  const ref = useReveal();
  const [active, setActive] = useState(0);
  return (
    <section id="modules" style={{ padding: "120px 0" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 56, maxWidth: 760 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>01 · {L.eyebrows.system}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,60px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>
            {L.modulesTitle}<br /><span style={{ color: "var(--brand)" }}>{L.modulesTitle2}</span>
          </h2>
          <p style={{ color: "var(--ink-70)", fontSize: 17, marginTop: 18, maxWidth: 600 }}>{L.modulesSub}</p>
        </div>
        <div className="mod-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {L.modules.map((m, i) => {
            const isOpen = active === i;
            return (
              <div key={m.id} className="module-card" onMouseEnter={() => setActive(i)} style={{
                background: "white", border: "1px solid var(--line)", borderRadius: 22, padding: 26,
                position: "relative", overflow: "hidden",
                boxShadow: isOpen ? "0 30px 60px -30px rgba(0,0,0,.16)" : "0 2px 6px rgba(0,0,0,.02)",
                transform: isOpen ? "translateY(-4px)" : "none",
              }}>
                <div style={{ position: "absolute", top: -60, insetInlineEnd: -60, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${m.color}22, transparent 70%)`, transition: "opacity .4s", opacity: isOpen ? 1 : .5 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, position: "relative" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${m.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{m.icon}</div>
                  <div>
                    <div className="mono-sm" style={{ color: m.color }}>{m.tag.toUpperCase()}</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>OpenSeat {m.tag}</div>
                  </div>
                </div>
                <h3 className="font-display" style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{m.name}</h3>
                <p style={{ color: "var(--ink-70)", fontSize: 14, marginTop: 0, marginBottom: 18 }}>{m.desc}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {m.features.map((f, k) => (
                    <li key={k} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--ink-70)" }}>
                      <span style={{ marginTop: 7, width: 5, height: 5, borderRadius: 999, background: m.color, flex: "0 0 auto" }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@media(max-width:960px){ .mod-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   How it works
   ═══════════════════════════════════════════════════════════ */
function How({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section id="how" style={{ padding: "120px 0", background: "var(--paper-2)", position: "relative", overflow: "hidden" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 56, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}>02 · {L.eyebrows.loop}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,60px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.howTitle}</h2>
          <p style={{ color: "var(--ink-70)", fontSize: 17, marginTop: 14, maxWidth: 620, marginInline: "auto" }}>{L.howSub}</p>
        </div>
        <div style={{ position: "relative" }}>
          <svg className="how-line" style={{ position: "absolute", top: 48, left: "5%", right: "5%", width: "90%", height: 60, pointerEvents: "none", zIndex: 0 }} viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path d="M0,30 C200,0 300,60 600,30 C900,0 1000,60 1200,30" stroke="var(--brand)" strokeWidth="2" strokeDasharray="4 6" fill="none" opacity=".4" />
          </svg>
          <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, position: "relative", zIndex: 1 }}>
            {L.howSteps.map((s, i) => (
              <div key={i} style={{ background: "white", border: "1px solid var(--line)", borderRadius: 18, padding: 24, animation: "slide-in-up .6s both", animationDelay: `${i * 0.1}s` }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--brand)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{s.icon}</div>
                <div className="mono-sm" style={{ color: "var(--brand)", marginBottom: 6 }}>{s.n}</div>
                <h3 className="font-display" style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>{s.t}</h3>
                <p style={{ fontSize: 14, color: "var(--ink-70)", margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:960px){ .how-grid{ grid-template-columns: repeat(2,1fr) !important; } .how-line{ display:none; } } @media(max-width:560px){ .how-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Why
   ═══════════════════════════════════════════════════════════ */
function Why({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section style={{ padding: "120px 0" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 56, maxWidth: 720 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>03 · {L.eyebrows.value}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,60px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.whyTitle}</h2>
        </div>
        <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: 22, overflow: "hidden" }}>
          {L.whyPoints.map((p, i) => (
            <div key={i} style={{ padding: 28, background: "var(--paper)", transition: "background .25s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "white"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--paper)"; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand-50)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><WhyIcon k={p.accent} /></div>
              <h3 className="font-display" style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>{p.t}</h3>
              <p style={{ fontSize: 14, color: "var(--ink-70)", margin: 0 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:900px){ .why-grid{ grid-template-columns: repeat(2,1fr) !important; } } @media(max-width:560px){ .why-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Comparison
   ═══════════════════════════════════════════════════════════ */
function Comparison({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section style={{ padding: "120px 0", background: "var(--paper-2)" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 40, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}>04 · {L.eyebrows.compare}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,60px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.cmpTitle}</h2>
          <p style={{ color: "var(--ink-70)", fontSize: 17, marginTop: 14 }}>{L.cmpSub}</p>
        </div>
        <div style={{ background: "white", borderRadius: 22, border: "1px solid var(--line)", overflow: "auto", boxShadow: "0 10px 30px -20px rgba(0,0,0,.1)" }}>
          <table className="cmp-table">
            <thead><tr>{L.cmpHeaders.map((h, i) => <th key={i} className={i === 1 ? "cmp-col-brand" : ""} style={{ color: i === 1 ? "var(--brand)" : undefined, fontSize: i === 1 ? 14 : undefined, padding: "18px 14px" }}>{h}</th>)}</tr></thead>
            <tbody>{L.cmpRows.map((row, i) => (
              <tr key={i} className="cmp-row">{row.map((c, k) => <td key={k} className={(k === 0 ? "row-label" : "row-cell ") + (k === 1 ? " cmp-col-brand" : "")}>{k === 0 ? c : <CmpCell v={c} />}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap", fontSize: 12, color: "var(--ink-50)" }}>
          <span><span className="cmp-check yes" style={{ width: 18, height: 18, fontSize: 11 }}>{"\u2713"}</span> {L.cmpLegend.yes}</span>
          <span><span className="cmp-check partial" style={{ width: 18, height: 18, fontSize: 11 }}>~</span> {L.cmpLegend.partial}</span>
          <span><span className="cmp-check no" style={{ width: 18, height: 18, fontSize: 11 }}>{"\u2715"}</span> {L.cmpLegend.no}</span>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Launch Banner
   ═══════════════════════════════════════════════════════════ */
function Launch({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section ref={ref} className="reveal" style={{ padding: "80px 0" }}>
      <div className="container-x">
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "48px 40px", background: "linear-gradient(135deg, var(--accent-warm) 0%, #FEE2E2 100%)", border: "1px solid var(--launch-border)" }}>
          <div style={{ position: "absolute", inset: 0, opacity: .5, backgroundImage: "repeating-linear-gradient(45deg, rgba(253,186,116,.2) 0 2px, transparent 2px 12px)", pointerEvents: "none" }} />
          <div className="launch-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 36, alignItems: "center", position: "relative" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "white", border: "1px solid var(--launch-border)", fontSize: 12, fontWeight: 600, color: "var(--brand)", marginBottom: 18 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand)", animation: "pulse-ring 2s infinite" }} />{L.launchKicker}
              </div>
              <h2 className="font-display" style={{ fontSize: "clamp(30px,3.6vw,46px)", lineHeight: 1.1, margin: "0 0 14px", fontWeight: 600, letterSpacing: "-0.02em" }}>{L.launchTitle}</h2>
              <p style={{ color: "var(--ink-70)", fontSize: 16, margin: "0 0 24px", maxWidth: 520 }}>{L.launchDesc}</p>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <a href="#contact" className="btn btn-primary">{L.launchCta} <span className="arrow">{"\u2192"}</span></a>
                <span style={{ fontSize: 12, color: "var(--ink-70)", fontFamily: "var(--font-mono)" }}>{L.launchNote}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ background: "white", borderRadius: 20, padding: 28, textAlign: "center", border: "1px solid var(--launch-border)", boxShadow: "0 30px 60px -30px rgba(196,30,58,.3)", minWidth: 240 }}>
                <div className="mono-sm" style={{ color: "var(--ink-50)", marginBottom: 8 }}>Growth · {L.pilotLabel}</div>
                <div style={{ fontSize: 18, color: "var(--ink-50)", textDecoration: "line-through", marginBottom: 6 }}>{"\u20AA"}799</div>
                <div className="font-display" style={{ fontSize: 56, lineHeight: 1, fontWeight: 700, color: "var(--brand)" }}>{"\u20AA"}299</div>
                <div style={{ fontSize: 13, color: "var(--ink-70)", marginTop: 6 }}>{L.pilotPrice}</div>
                <div style={{ marginTop: 18, padding: "10px 0 0", borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-50)" }}>{"\u2713"} {L.everythingIncluded}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@media(max-width:780px){ .launch-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Pricing
   ═══════════════════════════════════════════════════════════ */
function Pricing({ L }: { L: I18NData }) {
  const ref = useReveal();
  const [tier, setTier] = useState("80");
  const [annual, setAnnual] = useState(false);
  const mult = annual ? 10 / 12 : 1;
  return (
    <section id="pricing" style={{ padding: "120px 0" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 40, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}>05 · {L.eyebrows.pricing}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,60px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.pricingTitle}</h2>
          <p style={{ color: "var(--ink-70)", fontSize: 17, marginTop: 14, maxWidth: 620, marginInline: "auto" }}>{L.pricingSub}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", alignItems: "center", marginBottom: 40 }}>
          <div style={{ background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 999, padding: 4, display: "flex", gap: 2 }}>
            {L.tiers.map(t => <button key={t.id} onClick={() => setTier(t.id)} className={"tier-pill " + (tier === t.id ? "active" : "")}>{t.label}</button>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink-70)" }}>
            <span>{L.monthlyLabel}</span>
            <button className="toggle" aria-pressed={annual} onClick={() => setAnnual(!annual)} />
            <span>{L.annualLabel}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--brand-50)", color: "var(--brand)", fontWeight: 600 }}>-17%</span>
          </div>
        </div>
        <div className="plan-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {L.plans.map((p) => {
            const price = Math.round(p.prices[tier] * mult);
            return (
              <div key={p.name} className={"plan-card" + (p.popular ? " popular" : "")}>
                {p.popular && <div style={{ position: "absolute", top: -14, insetInlineStart: 24, background: "var(--brand)", color: "white", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 999, letterSpacing: ".08em" }}>{L.mostPopular}</div>}
                <div className="mono-sm" style={{ color: "var(--brand)" }}>{p.module}</div>
                <h3 className="font-display" style={{ margin: "10px 0 6px", fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>{p.name}</h3>
                <p style={{ color: "var(--ink-70)", fontSize: 14, margin: "0 0 20px" }}>{p.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                  <span className="font-display" style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: p.popular ? "var(--brand)" : "var(--ink)" }}>{"\u20AA"}{price.toLocaleString()}</span>
                  <span style={{ fontSize: 14, color: "var(--ink-50)" }}>/{L.perMonth}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 20, minHeight: 18 }}>{annual ? L.annualNote : L.monthlyNote}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {p.includes.map((x, k) => (
                    <li key={k} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 999, background: p.popular ? "var(--brand)" : "var(--ink)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flex: "0 0 auto", marginTop: 2 }}>{"\u2713"}</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={"btn " + (p.popular ? "btn-primary" : "btn-secondary")} style={{ width: "100%", justifyContent: "center" }}>{L.startWith(p.name)}</a>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@media(max-width:780px){ .plan-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Addons
   ═══════════════════════════════════════════════════════════ */
function Addons({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section style={{ padding: "40px 0 120px" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 32, textAlign: "center" }}>
          <h3 className="font-display" style={{ fontSize: "clamp(26px,3vw,36px)", margin: "0 0 10px", fontWeight: 600 }}>{L.addonsTitle}</h3>
          <p style={{ color: "var(--ink-70)", margin: 0 }}>{L.addonsSub}</p>
        </div>
        <div className="addon-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
          {L.addons.map((a, i) => (
            <div key={i} style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 16, background: "white", transition: "transform .25s, border-color .25s", cursor: "default" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>{a.p}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{a.t}</div>
              <div style={{ fontSize: 12, color: "var(--ink-70)", lineHeight: 1.5 }}>{a.d}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:1000px){ .addon-grid{ grid-template-columns: repeat(3,1fr) !important; } } @media(max-width:640px){ .addon-grid{ grid-template-columns: 1fr 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════════ */
function FAQ({ L }: { L: I18NData }) {
  const ref = useReveal();
  return (
    <section style={{ padding: "120px 0", background: "var(--paper-2)" }}>
      <div className="container-x" style={{ maxWidth: 860 }}>
        <div ref={ref} className="reveal" style={{ marginBottom: 40, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}>06 · FAQ</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,54px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.faqTitle}</h2>
        </div>
        <div style={{ background: "white", borderRadius: 22, border: "1px solid var(--line)", padding: "8px 28px" }}>
          {L.faq.map((f, i) => (
            <details className="faq" key={i} open={i === 0}>
              <summary>{f.q} <span className="plus">+</span></summary>
              <div className="answer">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Live Demo (interactive phone mockup)
   ═══════════════════════════════════════════════════════════ */
function LiveWidgetEmbed({ L }: { L: I18NData }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    const mountWidget = async () => {
      const host = hostRef.current;
      if (!host) return;

      setStatus("loading");
      host.innerHTML = "";

      try {
        await ensureLiveWidgetScript();
        if (cancelled || !hostRef.current) return;

        const widgetWindow = window as OpenSeatBookingWindow;
        widgetWindow.OpenSeatBooking?.mount(hostRef.current, {
          restaurantId: LIVE_WIDGET_RESTAURANT_ID,
          apiUrl: LIVE_WIDGET_API_URL,
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void mountWidget();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div style={{ marginTop: 24, padding: 18, borderRadius: 14, background: "white", border: "1px solid var(--line)", boxShadow: "0 10px 30px -20px rgba(0,0,0,.12)" }}>
      <div className="mono-sm" style={{ color: "var(--brand)", marginBottom: 8 }}>{L.embedLabel}</div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--ink-70)", lineHeight: 1.6 }}>{L.embedNote}</p>
      <div style={{ minHeight: 620, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", background: "var(--paper-2)" }}>
        {status === "error" ? (
          <div style={{ padding: 24, fontSize: 14, color: "var(--ink-70)" }}>{L.widgetError}</div>
        ) : (
          <div style={{ position: "relative", minHeight: 620 }}>
            {status === "loading" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--ink-50)", background: "var(--paper-2)" }}>
                {L.widgetLoading}
              </div>
            )}
            <div ref={hostRef} style={{ padding: 20, opacity: status === "ready" ? 1 : 0, transition: "opacity .2s ease" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function LiveDemo({ L }: { L: I18NData }) {
  const ref = useReveal();
  const w = L.widget;
  const [step, setStep] = useState(0);
  const [party, setParty] = useState(2);
  const [time, setTime] = useState("");
  const [seating, setSeating] = useState("indoor");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const times = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
  const reset = () => { setStep(0); setParty(2); setTime(""); setSeating("indoor"); setName(""); setPhone(""); };
  const submit = () => { setSubmitting(true); setTimeout(() => { setSubmitting(false); setStep(4); }, 1200); };

  return (
    <section id="demo" style={{ padding: "120px 0" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 40, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}>07 · {L.eyebrows.demo}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,54px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.demoTitle}</h2>
          <p style={{ color: "var(--ink-70)", fontSize: 17, marginTop: 14, maxWidth: 600, marginInline: "auto" }}>{L.demoSub}</p>
        </div>
        <div className="demo-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center", maxWidth: 1040, marginInline: "auto" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="phone">
              <div className="phone-screen" dir={L.dir}>
                <div style={{ padding: "30px 20px 14px", background: "linear-gradient(135deg, var(--brand), var(--brand-600))", color: "white" }}>
                  <div style={{ fontSize: 11, opacity: .8, fontFamily: "var(--font-mono)" }}>{w.restaurant.toUpperCase()}</div>
                  <div style={{ fontWeight: 700, fontSize: 20, marginTop: 2 }}>{w.title}</div>
                </div>
                <div style={{ padding: "18px 20px 0", display: "flex", gap: 4 }}>
                  {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= step && step < 4 ? "var(--brand)" : (step === 4 ? "var(--ok)" : "var(--line)"), transition: "background .4s" }} />)}
                </div>
                <div style={{ padding: "18px 20px 20px" }}>
                  {step === 0 && (
                    <div style={{ animation: "slide-in-up .3s both" }}>
                      <label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginBottom: 6 }}>{w.dateLabel}</label>
                      <input type="date" defaultValue={today} min={today} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper)", fontSize: 14, fontFamily: "var(--font-mono)" }} />
                      <label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginTop: 14, marginBottom: 8 }}>{w.partyLabel}</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <button key={n} onClick={() => setParty(n)} style={{ padding: "10px 0", borderRadius: 8, border: `1px solid ${party === n ? "var(--brand)" : "var(--line)"}`, background: party === n ? "var(--brand)" : "white", color: party === n ? "white" : "var(--ink)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{n}</button>
                        ))}
                      </div>
                      <button onClick={() => setStep(1)} style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 10, background: "var(--brand)", color: "white", fontWeight: 700, border: "none", cursor: "pointer" }}>{w.continue}</button>
                    </div>
                  )}
                  {step === 1 && (
                    <div style={{ animation: "slide-in-up .3s both" }}>
                      <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 10 }}>{w.timeLabel}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        {times.map(t => (
                          <button key={t} onClick={() => setTime(t)} style={{ padding: "10px 0", borderRadius: 8, border: `1px solid ${time === t ? "var(--brand)" : "var(--line)"}`, background: time === t ? "var(--brand)" : "white", color: time === t ? "white" : "var(--ink)", fontWeight: 600, cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)" }}>{t}</button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button onClick={() => setStep(0)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "transparent", fontWeight: 600, border: "1px solid var(--line)", cursor: "pointer" }}>{w.back}</button>
                        <button onClick={() => time && setStep(2)} disabled={!time} style={{ flex: 2, padding: 12, borderRadius: 10, background: time ? "var(--brand)" : "var(--paper-2)", color: time ? "white" : "var(--ink-50)", fontWeight: 700, border: "none", cursor: time ? "pointer" : "not-allowed" }}>{w.continue}</button>
                      </div>
                    </div>
                  )}
                  {step === 2 && (
                    <div style={{ animation: "slide-in-up .3s both" }}>
                      <div style={{ fontSize: 12, color: "var(--ink-50)", marginBottom: 8 }}>{w.seatingLabel}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
                        {([["indoor", "🏠"], ["outdoor", "🌿"], ["bar", "🍷"]] as const).map(([k, ic]) => (
                          <button key={k} onClick={() => setSeating(k)} style={{ padding: "12px 4px", borderRadius: 8, border: `1px solid ${seating === k ? "var(--brand)" : "var(--line)"}`, background: seating === k ? "var(--brand-50)" : "white", fontWeight: 600, cursor: "pointer", fontSize: 11 }}>
                            <div style={{ fontSize: 16, marginBottom: 2 }}>{ic}</div>{w.seating[k]}
                          </button>
                        ))}
                      </div>
                      <label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginBottom: 6 }}>{w.nameLabel}</label>
                      <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 10, fontSize: 13 }} />
                      <label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginBottom: 6 }}>{w.phoneLabel}</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="054-..." style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "var(--font-mono)" }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "transparent", fontWeight: 600, border: "1px solid var(--line)", cursor: "pointer" }}>{w.back}</button>
                        <button onClick={submit} disabled={!name || !phone || submitting} style={{ flex: 2, padding: 12, borderRadius: 10, background: (name && phone) ? "var(--brand)" : "var(--paper-2)", color: (name && phone) ? "white" : "var(--ink-50)", fontWeight: 700, border: "none", cursor: (name && phone) ? "pointer" : "not-allowed" }}>{submitting ? w.submitted : w.submit}</button>
                      </div>
                    </div>
                  )}
                  {step === 4 && (
                    <div style={{ animation: "slide-in-up .4s both", textAlign: "center", paddingTop: 20 }}>
                      <div style={{ width: 64, height: 64, borderRadius: 999, background: "#DCFCE7", color: "var(--ok)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 14 }}>{"\u2713"}</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{w.confirmedTitle}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-70)", marginBottom: 18 }}>{w.confirmedSub}</div>
                      <button onClick={reset} style={{ padding: "10px 16px", borderRadius: 10, background: "transparent", color: "var(--brand)", fontWeight: 600, border: "1px solid var(--brand)", cursor: "pointer", fontSize: 13 }}>{w.confirmedAnother}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {L.steps.map((s, i) => (
                <div key={i} style={{ padding: "18px 20px", borderRadius: 14, border: `1px solid ${(step === i || (i === 3 && step === 4)) ? "var(--brand)" : "var(--line)"}`, background: (step === i || (i === 3 && step === 4)) ? "white" : "transparent", boxShadow: (step === i || (i === 3 && step === 4)) ? "0 10px 30px -20px rgba(0,0,0,.15)" : "none", transition: "all .3s", display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: (step > i || (i === 3 && step === 4)) ? "var(--brand)" : (step === i ? "var(--brand-50)" : "var(--paper-2)"), color: (step > i || (i === 3 && step === 4)) ? "white" : (step === i ? "var(--brand)" : "var(--ink-50)"), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>{(step > i || (i === 3 && step === 4)) ? "\u2713" : String(i + 1).padStart(2, "0")}</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s}</div>
                </div>
              ))}
            </div>
            <LiveWidgetEmbed L={L} />
          </div>
        </div>
      </div>
      <style>{`@media(max-width:900px){ .demo-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Contact
   ═══════════════════════════════════════════════════════════ */
const FORMSPREE_URL = "https://formspree.io/f/xdapylqr";

function Contact({ L }: { L: I18NData }) {
  const ref = useReveal();
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_URL, { method: "POST", body: new FormData(e.currentTarget), headers: { Accept: "application/json" } });
      setStatus(res.ok ? "sent" : "idle");
      if (res.ok) (e.target as HTMLFormElement).reset();
    } catch { setStatus("idle"); }
  };
  const icons = ["\u23F1", "\u2705", "\uD83D\uDCAC"];
  return (
    <section id="contact" style={{ padding: "120px 0", background: "var(--paper-2)" }}>
      <div className="container-x">
        <div ref={ref} className="reveal" style={{ marginBottom: 40, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 16, justifyContent: "center" }}>08 · {L.eyebrows.talk}</div>
          <h2 className="font-display" style={{ fontSize: "clamp(36px,4.5vw,54px)", lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.03em" }}>{L.contactTitle}</h2>
          <p style={{ color: "var(--ink-70)", fontSize: 17, marginTop: 14, maxWidth: 620, marginInline: "auto" }}>{L.contactSub}</p>
        </div>
        <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, maxWidth: 1040, marginInline: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {L.contactLeft.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-50)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flex: "0 0 auto" }}>{icons[i]}</div>
                <div><div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{c.t}</div><div style={{ fontSize: 14, color: "var(--ink-70)" }}>{c.d}</div></div>
              </div>
            ))}
            <a href={`mailto:${L.footer.contact}`} style={{ marginTop: 8, padding: "18px 20px", borderRadius: 14, background: "white", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#25D366", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💬</div>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>WhatsApp / Email</div><div style={{ fontSize: 13, color: "var(--ink-70)", fontFamily: "var(--font-mono)" }}>{L.footer.contact}</div></div>
            </a>
          </div>
          <form onSubmit={handleSubmit} style={{ background: "white", border: "1px solid var(--line)", borderRadius: 22, padding: 28, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 20px 50px -30px rgba(0,0,0,.1)" }}>
            {([["name", L.formName, "text"], ["email", L.formEmail, "email"], ["restaurant", L.formRestaurant, "text"]] as const).map(([k, lbl, tp]) => (
              <div key={k}><label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginBottom: 6 }}>{lbl}</label><input type={tp} name={k} required style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "var(--paper)" }} /></div>
            ))}
            <div className="phone-seats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginBottom: 6 }}>{L.formPhone}</label><input type="tel" name="phone" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "var(--paper)" }} /></div>
              <div><label style={{ fontSize: 12, color: "var(--ink-50)", display: "block", marginBottom: 6 }}>{L.formSeats}</label><select name="seats" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "var(--paper)" }}><option>1-30</option><option>31-80</option><option>81-150</option><option>151-200</option><option>200+</option></select></div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
              {status === "sending" ? L.formSending : status === "sent" ? L.formSent : L.formSend}
              {status !== "sent" && <span className="arrow">{"\u2192"}</span>}
            </button>
          </form>
        </div>
      </div>
      <style>{`@media(max-width:900px){ .contact-grid{ grid-template-columns: 1fr !important; } } @media(max-width:480px){ .contact-grid form{ padding: 20px !important; } .contact-grid .phone-seats-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════════ */
function FooterSection({ L }: { L: I18NData }) {
  return (
    <footer>
      <div className="container-x" style={{ padding: "64px 24px 32px" }}>
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr repeat(3, 1fr)", gap: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width={30} height={30} viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="9" fill="var(--brand)" /><path d="M9 21c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6v1H9v-1z" fill="white" /><circle cx="16" cy="11" r="3.5" fill="white" /></svg>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "white" }}>OpenSeat</span>
            </div>
            <p style={{ marginTop: 14, color: "rgba(255,255,255,.7)", fontSize: 14, maxWidth: 320 }}>{L.footer.tagline}</p>
            <a href={`mailto:${L.footer.contact}`} style={{ display: "inline-flex", marginTop: 14, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,.08)", color: "white", fontFamily: "var(--font-mono)", fontSize: 12 }}>{L.footer.contact}</a>
          </div>
          {L.footer.cols.map((c, i) => (
            <div key={i}>
              <div className="mono-sm" style={{ color: "rgba(255,255,255,.6)", marginBottom: 14 }}>{c.t}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {c.items.map((x, k) => <li key={k}><a href="#" style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>{x}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", fontSize: 12, color: "rgba(255,255,255,.55)" }}>
          <span>{L.footer.rights}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="live-dot" /> {L.allSystems}</span>
        </div>
      </div>
      <style>{`@media(max-width:780px){ .footer-grid{ grid-template-columns: 1fr 1fr !important; } }`}</style>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   Root
   ═══════════════════════════════════════════════════════════ */
export function LandingPage() {
  const [lang, setLang] = useState<Lang>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("lang");
    if (p === "he" || p === "en" || p === "ar") return p;
    return "he";
  });

  const L = I18N[lang];

  useEffect(() => {
    document.documentElement.setAttribute("dir", L.dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, L.dir]);

  return (
    <>
      <Nav L={L} lang={lang} setLang={setLang} />
      <main>
        <Hero L={L} />
        <Tape L={L} />
        <Modules L={L} />
        <How L={L} />
        <Why L={L} />
        <Comparison L={L} />
        <Launch L={L} />
        <Pricing L={L} />
        <Addons L={L} />
        <FAQ L={L} />
        <LiveDemo L={L} />
        <Contact L={L} />
      </main>
      <FooterSection L={L} />
      <AccessibilityWidget lang={lang} />
    </>
  );
}
