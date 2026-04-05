import { useState, useEffect, type FormEvent } from "react";

type Lang = "he" | "en" | "ar";

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
  ar: {
    nav: { product: "المنتج", tools: "الأدوات", pricing: "الأسعار", demo: "تجربة" },
    hero: {
      title: "Sable",
      subtitle: "أذكى عضو في فريق مطعمك",
      desc: "نظام إدارة مطاعم متكامل - حجوزات، CRM ضيوف، ولاء، تلعيب، حملات وأتمتة. كل شيء بالذكاء الاصطناعي، عبر واتساب وموقعك.",
      cta1: "شاهد الأسعار",
      cta2: "اطلب عرض",
      trusted: "مدعوم بالذكاء الاصطناعي - يعمل 24/7 بدون توقف",
    },
    stats: [
      { value: "24/7", label: "بوت AI نشط" },
      { value: "30 دق", label: "توفير يومي" },
      { value: "0", label: "عمولة للزبون" },
      { value: "3×", label: "معدل عودة الضيوف" },
    ],
    toolsTitle: "كل الأدوات التي تحتاجها",
    toolsSubtitle: "كل أداة مصممة لتوفير وقتك وزيادة إيراداتك",
    tools: [
      {
        icon: "📅",
        title: "محرك الحجوزات",
        desc: "نظام حجوزات كامل مع تعيين طاولات تلقائي",
        features: [
          "تعيين طاولات ذكي - مطابقة تلقائية حسب حجم المجموعة",
          "توفر فوري حسب ساعات العمل",
          "إدارة ساعات العمل والتواريخ الخاصة",
          "تذكيرات تلقائية قبل 3 ساعات",
          "تتبع عدم الحضور والإبلاغ",
          "تأكيد، إجلاس، إنهاء، إلغاء - بنقرة واحدة",
        ],
      },
      {
        icon: "⏳",
        title: "قائمة الانتظار",
        desc: "إدارة تلقائية لقائمة الانتظار مع مطابقة ذكية",
        features: [
          "إضافة لقائمة الانتظار عند الامتلاء",
          "مطابقة تلقائية عند توفر طاولة (إلغاء → عرض)",
          "عد تنازلي 15 دقيقة لقبول العرض",
          "قبول → تحويل تلقائي لحجز",
          "أولوية حسب ترتيب الوصول",
        ],
      },
      {
        icon: "🖥️",
        title: "لوحة تحكم المالك",
        desc: "مركز تحكم فوري لكل ما يحدث في مطعمك",
        features: [
          "عرض اليوم - حجوزات، ضيوف، إلغاءات، عدم حضور",
          "خريطة إشغال بالساعة",
          "خريطة طاولات حية - متاح / محجوز / مشغول",
          "إنشاء حجز من لوحة التحكم (مكالمات هاتفية)",
          "تصفية حسب التاريخ، الحالة، بحث ضيف",
          "تنقل سريع مع أسهم + عدادات جانبية",
          "لوحة تعديل الحجز (منزلقة)",
          "تعديل ساعات العمل + إدارة الطاولات",
        ],
      },
      {
        icon: "🔗",
        title: "ودجة حجز للموقع",
        desc: "ودجة حجز قابلة للتضمين - سطر كود واحد في موقعك",
        features: [
          "توفر فوري - تاريخ → وقت → تفاصيل → تأكيد",
          "تصميم مخصص - لون أساسي، شعار، نص ترحيب",
          "التحقق من رقم الهاتف الإسرائيلي",
          "تصميم موبايل أولاً مع دعم RTL كامل",
          "حزمة صغيرة (<20KB) - لا تبطئ موقعك",
          'تضمين بسطر واحد: <script src="...">',
        ],
      },
      {
        icon: "👤",
        title: "CRM الضيوف",
        desc: "ملف كامل لكل ضيف - كل شيء في مكان واحد",
        features: [
          "إنشاء تلقائي في الحجز الأول",
          "تاريخ زيارات كامل (تواريخ، أطباق، تقييمات)",
          "تفضيلات غذائية (نباتي، فيغان، حساسيات، كشروت)",
          "علامات تلقائية: VIP، عائد، جديد، معرض للخطر، منفق كبير",
          "ملاحظات الطاقم + حقل المناسبة (عيد ميلاد، عمل، موعد)",
          "رؤى: أطباق مفضلة، تكرار الزيارة، تفضيل يوم/ساعة",
          "بحث بالاسم أو الهاتف",
        ],
      },
      {
        icon: "📝",
        title: "تتبع الزيارات والتقييم",
        desc: "اعرف ماذا أكل كل ضيف، ما رأيه، وما يحب",
        features: [
          "سجل زيارة: أطباق، إنفاق، تقييم، ملاحظات، مناسبة",
          "ملف غذائي متراكم من كل الزيارات",
          "تحليل المشاعر (إيجابي / محايد / سلبي)",
          "تقييم >= 4 → علامة 'راضي' + طلب مراجعة Google",
          "تقييم <= 2 → علامة 'معرض للخطر' + تنبيه المالك",
          "ملخص تقييم المطعم: متوسط، توزيع، شكاوى حديثة",
        ],
      },
      {
        icon: "⭐",
        title: "محرك الولاء",
        desc: "نقاط، طوابع، درجات VIP - كل شيء تلقائي",
        features: [
          "10 نقاط لكل زيارة × مضاعف الدرجة (برونز ×1، فضي ×1.5، ذهبي ×2)",
          "بطاقة طوابع: كل 10 زيارات = 50 نقطة إضافية",
          "درجات VIP تلقائية: برونز → فضي (5+ زيارات) → ذهبي (15+)",
          "كتالوج مكافآت - إنشاء واستبدال بكود فريد",
          "تاريخ معاملات النقاط",
          "الضيف يسأل في واتساب: 'ما رصيدي؟' - البوت يجيب",
        ],
      },
      {
        icon: "🎮",
        title: "التلعيب",
        desc: "حوّل الزيارات إلى لعبة - أعطِ الضيوف سبباً للعودة",
        features: [
          "نظام إحالة - كود فريد، 50 نقطة للمُحيل + 25 للجديد",
          "تحديات - 'زر 3 مرات هذا الأسبوع' مع مكافأة",
          "سلاسل زيارات - مكافأة على زيارات أسبوعية متتالية (3، 5، 10، 20)",
          "تتبع تقدم تلقائي",
          "مكافآت إنجاز (نقاط × طول السلسلة)",
        ],
      },
      {
        icon: "🤖",
        title: "أتمتة التسويق",
        desc: "رسائل تلقائية تُرسل في الوقت المناسب",
        features: [
          "شكراً بعد الزيارة - يُرسل بعد ساعتين من الانتهاء",
          "طلب مراجعة - 24 ساعة بعد، فقط للضيوف بـ 3+ زيارات",
          "تهنئة عيد ميلاد - تهنئة تلقائية + 100 نقطة إضافية",
          "استعادة - 30/60/90 يوم بعد آخر زيارة مع عروض متصاعدة",
          "كل الرسائل تحترم ساعات الهدوء (22:00-08:00)",
        ],
      },
      {
        icon: "💬",
        title: "بوت واتساب AI",
        desc: "حجوزات، أسئلة، ولاء - كل شيء عبر واتساب",
        features: [
          "حجز طاولة في محادثة طبيعية (قريباً)",
          "كشف لغة تلقائي - عبري، إنجليزي، عربي",
          "البوت يعرف الضيف - يحمّل الملف الكامل في كل محادثة",
          "فحص رصيد النقاط، استبدال المكافآت",
          "تحويل لإنسان عند الحاجة",
          "ملخص يومي للمالك عبر واتساب",
        ],
      },
      {
        icon: "🔐",
        title: "الأمان والوصول",
        desc: "بياناتك محمية - الوصول فقط بتصريح",
        features: [
          "مصادقة JWT على كل المسارات",
          "تسجيل دخول بالبريد وكلمة المرور",
          "عزل البيانات لكل مطعم",
          "مسارات عامة: التوفر + الحجز (للودجة)",
          "مسارات محمية: لوحة التحكم، الضيوف، الإعدادات",
        ],
      },
    ],
    howTitle: "كيف يعمل",
    howSteps: [
      { num: "1", title: "الضيف يحجز", desc: "عبر واتساب، موقعك، أو الهاتف - الحجز يدخل النظام" },
      { num: "2", title: "AI يدير", desc: "طاولة تُعيّن تلقائياً، تأكيد يُرسل، تذكير مجدول" },
      { num: "3", title: "الضيف يصل", desc: "الطاقم يرى كل شيء في لوحة التحكم - ملف، تفضيلات، تاريخ" },
      { num: "4", title: "بعد الزيارة", desc: "نقاط تُكسب، شكراً يُرسل، مراجعة تُطلب، والضيف يعود" },
    ],
    comparisonTitle: "لماذا Sable وليس المنافسين",
    comparison: {
      headers: ["", "Sable", "Ontopo", "Tabit", "SevenRooms"],
      rows: [
        ["حجوزات أونلاين", "v", "v", "v", "v"],
        ["بوت واتساب AI", "v", "x", "x", "x"],
        ["CRM ضيوف", "v", "x", "~", "v"],
        ["ولاء + تلعيب", "v", "x", "x", "v"],
        ["أتمتة تسويق", "v", "x", "x", "v"],
        ["ودجة للموقع", "v", "x", "v", "v"],
        ["بدون عمولة للزبون", "v", "v", "x", "x"],
        ["السعر", "من ₪499", "مجاني", "₪800+", "$500+"],
      ],
    },
    launch: {
      title: "عرض الإطلاق - أول 5 مطاعم",
      desc: "نظام حجوزات كامل بـ ₪299 مرة واحدة. بدون اشتراك شهري. 5 أماكن فقط.",
      cta: "تريد مكان؟ تحدث معنا",
      note: "بعد الإطلاق: اشتراكات شهرية من ₪499/شهر",
    },
    pricing: {
      title: "الأسعار",
      subtitle: "حسب عدد المقاعد. بدون عمولة للزبون. 14 يوم تجربة مجانية.",
      starter: {
        name: "Starter",
        desc: "حجوزات + ودجة + لوحة تحكم",
        includes: ["محرك حجوزات كامل", "ودجة حجز للموقع", "لوحة تحكم المالك", "قائمة انتظار", "تذكيرات تلقائية", "إدارة ساعات + طاولات", "تتبع عدم الحضور"],
      },
      standard: {
        name: "Standard",
        desc: "كل شيء في Starter + ولاء + CRM + أتمتة",
        includes: ["كل شيء في Starter", "CRM ضيوف كامل", "محرك ولاء (نقاط + طوابع + VIP)", "تتبع زيارات + تقييم + تحليل مشاعر", "تلعيب (إحالات + تحديات + سلاسل)", "أتمتة تسويق (شكراً، عيد ميلاد، استعادة)", "تعليم ضيوف تلقائي"],
      },
      annual: "خصم سنوي: ادفع 10 أشهر، احصل على 12.",
    },
    addons: {
      title: "إضافات",
      items: [
        { name: "بوت واتساب AI", price: "₪149/شهر", desc: "بوت AI لمحادثات + حجوزات واتساب" },
        { name: "حملات وتسويق", price: "₪99/شهر", desc: "تقسيم، قوالب، إرسال مجدول" },
        { name: "تلعيب متقدم", price: "₪79/شهر", desc: "تحديات، عجلة حظ، لوحة متصدرين، مكافآت" },
        { name: "تحليلات وتقارير", price: "₪59/شهر", desc: "استبقاء، CLV، ROI حملات، خرائط حرارة" },
      ],
    },
    cta: {
      title: "مستعد للتجربة؟",
      desc: "14 يوم تجربة مجانية. بدون بطاقة ائتمان. بدون التزام.",
      button: "تحدث معنا",
    },
    faq: {
      title: "أسئلة شائعة",
      items: [
        { q: "هل أحتاج معرفة تقنية؟", a: "لا. الودجة تُضمّن بسطر واحد، لوحة التحكم تعمل من المتصفح، وواتساب يعمل وحده." },
        { q: "ماذا يحدث بعد التجربة؟", a: "اختر خطة وابدأ بالدفع. بدون مفاجآت، بدون رسوم مخفية." },
        { q: "هل هناك عمولة للزبون؟", a: "لا. أبداً. اشتراك شهري ثابت حسب عدد المقاعد." },
        { q: "ما اللغات التي يدعمها البوت؟", a: "عبري، إنجليزي، وعربي. كشف لغة تلقائي." },
        { q: "هل يمكنني التجربة قبل الدفع؟", a: "نعم! 14 يوم تجربة مجانية، بدون بطاقة ائتمان." },
      ],
    },
  },
};

const API_URL = "http://204.168.227.45";
const RESTAURANT_ID = "c3c22e37-a309-4fde-aa6c-6e714212a3bc";

interface AvailabilitySlot {
  time: string;
  availableTables: number;
  maxPartySize: number;
}

type WidgetStep = "date" | "time" | "details" | "confirm";

function isValidIsraeliPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+972")) return /^\+972\d{8,9}$/.test(digits);
  if (digits.startsWith("0")) return /^0\d{9}$/.test(digits);
  return false;
}

function DemoWidget() {
  const [step, setStep] = useState<WidgetStep>("date");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        body: JSON.stringify({ restaurantId: RESTAURANT_ID, guestName: name, guestPhone: phone, date, timeStart: time, partySize, source: "web" }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Booking failed"); }
      setStep("confirm");
    } catch (e: any) { setError(e.message || "Booking failed"); }
    finally { setSubmitting(false); }
  };

  const accent = "#d97706";
  const btnStyle = "w-full py-3 rounded-xl font-semibold text-white transition";

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 max-w-sm mx-auto" dir="rtl">
      <h3 className="text-lg font-bold mb-4 text-center">הזמנת שולחן - BFF Ra'anana</h3>

      {error && <div className="p-2 mb-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {step === "date" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">תאריך</label>
            <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm mb-1">מספר סועדים</label>
            <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={() => date && setStep("time")} className={btnStyle} style={{ background: accent }}>המשך</button>
        </div>
      )}

      {step === "time" && (
        <div>
          <p className="text-sm text-gray-500 mb-3">שעות פנויות ל-{date} ({partySize} סועדים)</p>
          {loadingSlots ? (
            <p className="text-gray-400 text-sm">טוען שעות פנויות...</p>
          ) : slots.length === 0 ? (
            <p className="text-gray-400 text-sm">אין שעות פנויות לתאריך זה</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button key={slot.time} onClick={() => { setTime(slot.time); setStep("details"); }}
                  className={`py-2 rounded-lg border text-sm font-semibold transition ${time === slot.time ? "text-white" : "border-gray-200 hover:border-amber-300"}`}
                  style={time === slot.time ? { background: accent, borderColor: accent, color: "#fff" } : {}}>
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep("date")} className="mt-4 text-sm text-gray-500 hover:text-gray-700">&larr; חזרה</button>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{date} | {time} | {partySize} סועדים</p>
          <div>
            <label className="block text-sm mb-1">שם</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm mb-1">טלפון</label>
            <input type="tel" value={phone}
              onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(""); }}
              onBlur={() => { if (phone && !isValidIsraeliPhone(phone)) setPhoneError("מספר טלפון לא תקין"); }}
              className={`w-full p-2 border rounded-lg ${phoneError ? "border-red-500" : "border-gray-300"}`} />
            {phoneError && <p className="text-red-600 text-xs mt-1">{phoneError}</p>}
          </div>
          <button
            onClick={() => { if (!isValidIsraeliPhone(phone)) { setPhoneError("מספר טלפון לא תקין"); return; } handleSubmit(); }}
            disabled={!name || !phone || submitting}
            className={btnStyle}
            style={{ background: submitting ? "#9ca3af" : accent }}>
            {submitting ? "שולח..." : "אישור הזמנה"}
          </button>
          <button onClick={() => setStep("time")} className="text-sm text-gray-500 hover:text-gray-700 block">&larr; חזרה</button>
        </div>
      )}

      {step === "confirm" && (
        <div className="text-center py-6">
          <p className="text-4xl mb-2">&#x2705;</p>
          <p className="text-lg font-bold">ההזמנה התקבלה!</p>
          <p className="text-sm text-gray-500 mt-1">{date} בשעה {time} | {partySize} סועדים</p>
          <p className="text-xs text-gray-400 mt-2">אישור יישלח אליך בוואטסאפ</p>
        </div>
      )}
    </div>
  );
}

/* ── Accessibility Widget ── */
const a11yStorageKey = "sable-accessibility-settings";
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
                  <button key={b.label} onClick={b.fn} className="min-w-[4.5rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:border-amber-400">{b.label}</button>
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
                  className="h-5 w-5 shrink-0 accent-amber-600" />
              </label>
            ))}
            <button onClick={() => update(a11yDefaults)}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition">{copy.resetAll}</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={copy.button}
        className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-600 px-3 py-3 text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700 hover:-translate-y-0.5">
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v4.5m0 0l-4.5 1.5m4.5-1.5l4.5 1.5M10 22l2-6 2 6m-6-3h8" />
        </svg>
        <span className="hidden text-sm font-semibold sm:inline">{copy.button}</span>
      </button>
    </div>
  );
}

const FORMSPREE_URL = "https://formspree.io/f/milhemsione@gmail.com";
const CAL_LINK = "https://cal.com/sable/intro";

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

  const inputCls = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition";

  return (
    <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-start">
      <div>
        <h2 className="text-3xl font-bold mb-4">{l.title}</h2>
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <span className="text-xl">&#128337;</span>
            </div>
            <div>
              <p className="font-semibold">{lang === "he" ? "15 דקות, בלי בלבולים" : lang === "ar" ? "15 دقيقة، بدون تعقيد" : "15 minutes, no fluff"}</p>
              <p className="text-sm text-gray-500">{lang === "he" ? "שיחה קצרה, תשובות אמיתיות." : lang === "ar" ? "مكالمة قصيرة، إجابات حقيقية." : "Quick call, real answers."}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <span className="text-xl">&#9989;</span>
            </div>
            <div>
              <p className="font-semibold">{lang === "he" ? "התסריטים שלך, לא שלנו" : lang === "ar" ? "سيناريوهاتك، ليس سيناريوهاتنا" : "Your scenarios, not ours"}</p>
              <p className="text-sm text-gray-500">{lang === "he" ? "ספר לנו על המסעדה ונראה לך תוצאות רלוונטיות." : lang === "ar" ? "أخبرنا عن مطعمك وسنعرض لك نتائج ذات صلة." : "Tell us about your restaurant and we'll show relevant results."}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
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
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-amber-600 text-amber-700 rounded-xl font-semibold hover:bg-amber-50 transition">
            <span>&#128197;</span> {l.scheduleBtn}
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">{l.name}</label>
          <input type="text" id="name" name="name" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{l.email}</label>
          <input type="email" id="email" name="email" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="restaurant" className="block text-sm font-medium text-gray-700 mb-1">{l.restaurant}</label>
          <input type="text" id="restaurant" name="restaurant" required className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">{l.phone}</label>
            <input type="tel" id="phone" name="phone" className={inputCls} />
          </div>
          <div>
            <label htmlFor="seats" className="block text-sm font-medium text-gray-700 mb-1">{l.seats}</label>
            <select id="seats" name="seats" className={inputCls}>
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
          <textarea id="message" name="message" rows={3} className={inputCls} />
        </div>
        <button type="submit" disabled={status === "sending"}
          className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-lg hover:bg-amber-700 transition disabled:bg-gray-400">
          {status === "sending" ? l.sending : l.send}
        </button>
        {status === "sent" && <p className="text-green-600 text-sm text-center">{l.sent}</p>}
        {status === "error" && <p className="text-red-600 text-sm text-center">{l.error}</p>}
      </form>
    </div>
  );
}

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
  const dir = lang === "en" ? "ltr" : "rtl";
  const su = lang === "he" ? "מושבים" : lang === "ar" ? "مقعد" : "seats";
  const pm = lang === "he" ? "/חודש" : lang === "ar" ? "/شهر" : "/mo";
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div dir={dir} className="min-h-screen bg-white text-gray-900" style={{ direction: dir }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">Sable</span>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#demo" className="text-gray-600 hover:text-gray-900">{c.nav.demo}</a>
            <a href="#tools" className="text-gray-600 hover:text-gray-900">{c.nav.tools}</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900">{c.nav.pricing}</a>
            <a href="#contact" className="text-gray-600 hover:text-gray-900">{lang === "he" ? "צור קשר" : lang === "ar" ? "تواصل" : "Contact"}</a>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
              className="px-3 py-1 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition text-sm cursor-pointer">
              <option value="he">עברית</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          {/* Mobile menu button */}
          <div className="flex items-center gap-3 md:hidden">
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
              className="px-2 py-1 border border-gray-300 rounded-lg bg-white text-sm cursor-pointer">
              <option value="he">עב</option>
              <option value="en">EN</option>
              <option value="ar">عر</option>
            </select>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2 text-gray-600" aria-label="Menu">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenu
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden mt-3 pb-2 border-t border-gray-100 pt-3 flex flex-col gap-3 text-sm">
            <a href="#demo" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.demo}</a>
            <a href="#tools" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.tools}</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{c.nav.pricing}</a>
            <a href="#contact" onClick={() => setMobileMenu(false)} className="text-gray-600 hover:text-gray-900">{lang === "he" ? "צור קשר" : lang === "ar" ? "تواصل" : "Contact"}</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <header className="bg-gradient-to-b from-amber-50 to-white px-4 sm:px-6 py-12 sm:py-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">{c.hero.title}</h1>
        <p className="text-xl sm:text-2xl md:text-3xl text-gray-700 mt-3 font-medium">{c.hero.subtitle}</p>
        <p className="text-base sm:text-lg text-gray-500 mt-4 max-w-2xl mx-auto">{c.hero.desc}</p>
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
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {c.howSteps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-600 text-white rounded-full flex items-center justify-center text-lg md:text-xl font-bold mx-auto mb-3">{step.num}</div>
              <h3 className="font-bold mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Demo Widget */}
      <section id="demo" className="px-6 py-20 bg-gradient-to-b from-white to-amber-50">
        <h2 className="text-3xl font-bold text-center mb-2">{lang === "he" ? "נסה עכשיו" : lang === "ar" ? "جرّب الآن" : "Try it now"}</h2>
        <p className="text-center text-gray-500 mb-10">{lang === "he" ? "ככה נראית הזמנה מהאתר שלך - ווידג'ט שנטען בשורת קוד אחת" : lang === "ar" ? "هكذا يبدو الحجز من موقعك - ودجة تُحمّل بسطر كود واحد" : "This is how booking looks on your website - a widget loaded with one line of code"}</p>
        <DemoWidget />
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
          <a href="mailto:milhemsione@gmail.com" className="inline-block px-8 py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition">{c.launch.cta}</a>
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

      {/* Contact */}
      <section id="contact" className="px-6 py-20 bg-gradient-to-b from-amber-50 to-white">
        <ContactForm lang={lang} />
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        Sable &copy; 2026 KaspaCom
      </footer>

      {/* Accessibility Widget */}
      <AccessibilityWidget lang={lang} />
    </div>
  );
}
