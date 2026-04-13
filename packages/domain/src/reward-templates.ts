export const REWARD_MOMENT_KEYS = [
  "returning",
  "comeback",
  "midweek",
  "birthday",
  "celebration",
  "referral",
  "milestone",
  "group",
  "host",
] as const;

export type RewardMomentKey = typeof REWARD_MOMENT_KEYS[number];

export const REWARD_MOMENT_LABELS: Record<RewardMomentKey, { he: string; en: string }> = {
  returning: { he: "אורח חוזר", en: "Returning guest" },
  comeback: { he: "חזרה אחרי היעלמות", en: "Comeback" },
  midweek: { he: "אמצע שבוע", en: "Midweek" },
  birthday: { he: "יום הולדת", en: "Birthday" },
  celebration: { he: "חגיגה", en: "Celebration" },
  referral: { he: "חבר מביא חבר", en: "Referral" },
  milestone: { he: "אבן דרך", en: "Milestone" },
  group: { he: "קבוצה", en: "Group" },
  host: { he: "מארח", en: "Host" },
};

export interface RewardTemplateDefinition {
  id: string;
  title: { he: string; en: string };
  moment: { he: string; en: string };
  offer: { he: string; en: string };
  why: { he: string; en: string };
  pitch: { he: string; en: string };
  rewardNameHe: string;
  rewardNameEn: string;
  rewardDescriptionHe: string;
  rewardDescriptionEn: string;
  pointsCost: number;
  recommendedMoments: RewardMomentKey[];
}

export const BFF_REWARD_TEMPLATES: RewardTemplateDefinition[] = [
  {
    id: "dessert-next-visit",
    title: { he: "חוזר מתוק", en: "Sweet comeback" },
    moment: { he: "לאורח חוזר שצריך עוד דחיפה קטנה", en: "For a returning guest who needs one small nudge" },
    offer: { he: "קינוח עלינו בביקור הבא", en: "Dessert on the next visit" },
    why: { he: "ברור, כיפי, ובדרך כלל זול יחסית למסעדה.", en: "Clear, generous, and usually margin-friendly for the restaurant." },
    pitch: { he: "בביקור הבא הקינוח עלינו.", en: "On your next visit, dessert is on us." },
    rewardNameHe: "קינוח עלינו בביקור הבא",
    rewardNameEn: "Dessert on your next visit",
    rewardDescriptionHe: "מעולה לאורח חוזר שצריך עוד סיבה טובה לקפוץ שוב.",
    rewardDescriptionEn: "Great for returning guests who just need a small reason to come back soon.",
    pointsCost: 80,
    recommendedMoments: ["returning", "comeback", "milestone"],
  },
  {
    id: "midweek-discount",
    title: { he: "אמצע שבוע חכם", en: "Midweek mover" },
    moment: { he: "לימים חלשים או לאורח שנעלם קצת", en: "For softer nights or a guest who has gone quiet" },
    offer: { he: "10% הנחה לאמצע שבוע", en: "10% off on a midweek visit" },
    why: { he: "ממלא ימים חלשים בלי לפגוע בסופ״ש החזק.", en: "Helps fill quieter nights without touching your strongest weekend demand." },
    pitch: { he: "אם בא לך לקפוץ באמצע שבוע, שמרתי לך 10% הנחה.", en: "If you feel like dropping by midweek, I saved you 10% off." },
    rewardNameHe: "10% הנחה לאמצע שבוע",
    rewardNameEn: "10% off midweek",
    rewardDescriptionHe: "הטבה חכמה להחזרת אורחים באמצע שבוע בלי לשרוף מבצעים על הימים החזקים.",
    rewardDescriptionEn: "A smart comeback offer for quieter nights without discounting peak days.",
    pointsCost: 120,
    recommendedMoments: ["midweek", "comeback"],
  },
  {
    id: "starter-for-table",
    title: { he: "פותחים שולחן", en: "Table starter" },
    moment: { he: "לחבר מביא חבר או לקבוצה קטנה", en: "For referrals or a small social group" },
    offer: { he: "מנה ראשונה לשולחן עלינו", en: "A starter for the table" },
    why: { he: "מרגיש נדיב ומעודד להזמין עוד אנשים.", en: "Feels generous and pushes guests to bring more people." },
    pitch: { he: "תבואו כמה חבר׳ה ויש לכם מנה ראשונה לשולחן עלינו.", en: "Come with a few friends and the table gets a starter on us." },
    rewardNameHe: "מנה ראשונה לשולחן עלינו",
    rewardNameEn: "Starter for the table",
    rewardDescriptionHe: "מעולה להזמנות חברתיות, מביאי חבר, וערבים שרוצים למלא שולחנות.",
    rewardDescriptionEn: "Great for social bookings, referrals, and nights where you want fuller tables.",
    pointsCost: 140,
    recommendedMoments: ["referral", "group"],
  },
  {
    id: "birthday-table-treat",
    title: { he: "יום הולדת כמו שצריך", en: "Birthday table treat" },
    moment: { he: "לימי הולדת וחגיגות", en: "For birthdays and celebration tables" },
    offer: { he: "צ׳ופר יום הולדת לשולחן", en: "Birthday treat for the table" },
    why: { he: "יוצר רגע זכיר ונותן לצוות משהו קל וברור להגיש.", en: "Creates a memorable moment and gives staff something easy to honor." },
    pitch: { he: "ביום הולדת אצלנו דואגים לכם לצ׳ופר קטן לשולחן.", en: "For birthdays with us, the table gets a little treat from the house." },
    rewardNameHe: "צ׳ופר יום הולדת לשולחן",
    rewardNameEn: "Birthday table treat",
    rewardDescriptionHe: "מושלם ליום הולדת, יום נישואין, או כל שולחן חגיגי שצריך להרגיש מיוחד.",
    rewardDescriptionEn: "Perfect for birthdays, anniversaries, or any celebration table that should feel special.",
    pointsCost: 180,
    recommendedMoments: ["birthday", "celebration"],
  },
  {
    id: "referral-dessert",
    title: { he: "חבר מביא חבר", en: "Bring-a-friend" },
    moment: { he: "כשבא לך לעודד המלצות טבעיות", en: "When you want easy word-of-mouth growth" },
    offer: { he: "קינוח עלינו לחבר מביא חבר", en: "Dessert on us for a referral" },
    why: { he: "פשוט להסביר, מרגיש הוגן, ועובד טוב בלי בירוקרטיה.", en: "Simple to explain, fair for both sides, and easy to honor." },
    pitch: { he: "תביא חבר חדש, ונדאג לכם לקינוח עלינו.", en: "Bring a new friend in and we’ll take care of dessert." },
    rewardNameHe: "קינוח עלינו לחבר מביא חבר",
    rewardNameEn: "Referral dessert on us",
    rewardDescriptionHe: "הטבה קלילה לעידוד המלצות אמיתיות בלי לסבך את השיחה.",
    rewardDescriptionEn: "A light, easy referral reward that keeps the message clean and natural.",
    pointsCost: 120,
    recommendedMoments: ["referral"],
  },
  {
    id: "host-perk",
    title: { he: "מארח שמביא שולחן", en: "Host perk" },
    moment: { he: "לקבוצות 6+ או אורח שתמיד מארגן את החבורה", en: "For 6+ groups or the guest who always organizes the crew" },
    offer: { he: "צ׳ופר למארח קבוצה", en: "Host perk for a group booking" },
    why: { he: "נותן לאדם אחד סיבה טובה לאסוף את כולם דווקא אליך.", en: "Gives one person a real reason to gather everyone at your place." },
    pitch: { he: "על קבוצה יפה אצלנו, יש צ׳ופר קטן למארח.", en: "For a proper group booking, the host gets a little extra from us." },
    rewardNameHe: "צ׳ופר למארח קבוצה",
    rewardNameEn: "Host perk for group booking",
    rewardDescriptionHe: "מעולה ליצירת הזמנות קבוצתיות ולחיזוק האורח שמביא את כל החבורה.",
    rewardDescriptionEn: "Great for group bookings and for rewarding the person who brings everyone together.",
    pointsCost: 220,
    recommendedMoments: ["group", "host"],
  },
];

export function getRewardTemplateById(templateKey?: string | null) {
  return BFF_REWARD_TEMPLATES.find((template) => template.id === templateKey);
}
