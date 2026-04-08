import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────

export const packageEnum = pgEnum("package", ["starter", "growth"]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);
export const reservationSourceEnum = pgEnum("reservation_source", [
  "whatsapp",
  "web",
  "walk_in",
  "phone",
  "telegram",
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "offered",
  "accepted",
  "expired",
]);
export const guestSourceEnum = pgEnum("guest_source", [
  "whatsapp",
  "web",
  "walk_in",
  "referral",
  "telegram",
]);
export const languageEnum = pgEnum("language", ["he", "en", "ar", "ru"]);
export const tierEnum = pgEnum("tier", ["bronze", "silver", "gold"]);
export const adminRoleEnum = pgEnum("admin_role", ["admin", "employee", "super_admin"]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "escalated",
  "closed",
]);

// ── Core Tables ────────────────────────────────────────

export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  cuisineType: varchar("cuisine_type", { length: 100 }),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  timezone: varchar("timezone", { length: 50 }).notNull().default("Asia/Jerusalem"),
  locale: varchar("locale", { length: 10 }).notNull().default("he"),
  operatingHours: jsonb("operating_hours"),
  specialDates: jsonb("special_dates"),
  agentConfig: jsonb("agent_config"),
  package: packageEnum("package").notNull().default("starter"),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }),
  ownerPhone: varchar("owner_phone", { length: 20 }),
  ownerWhatsapp: varchar("owner_whatsapp", { length: 20 }),
  googlePlaceId: varchar("google_place_id", { length: 255 }),
  widgetConfig: jsonb("widget_config"),
  dashboardConfig: jsonb("dashboard_config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  role: adminRoleEnum("role").notNull().default("admin"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tables = pgTable("tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: varchar("name", { length: 50 }).notNull(),
  minSeats: integer("min_seats").notNull().default(1),
  maxSeats: integer("max_seats").notNull(),
  zone: varchar("zone", { length: 50 }),
  combinableWith: jsonb("combinable_with").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
});

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  language: languageEnum("language").notNull().default("he"),
  source: guestSourceEnum("source").notNull().default("web"),
  firstVisitDate: date("first_visit_date"),
  lastVisitDate: date("last_visit_date"),
  visitCount: integer("visit_count").notNull().default(0),
  noShowCount: integer("no_show_count").notNull().default(0),
  tier: tierEnum("tier").default("bronze"),
  pointsBalance: integer("points_balance").notNull().default(0),
  preferences: jsonb("preferences"),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  optedOutCampaigns: boolean("opted_out_campaigns").notNull().default(false),
  referralCode: varchar("referral_code", { length: 20 }),
  referredBy: uuid("referred_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  date: date("date").notNull().$type<string>(),
  timeStart: time("time_start").notNull().$type<string>(),
  timeEnd: time("time_end").$type<string | null>(),
  partySize: integer("party_size").notNull(),
  tableIds: jsonb("table_ids").$type<string[]>(),
  status: reservationStatusEnum("status").notNull().default("pending"),
  source: reservationSourceEnum("source").notNull().default("web"),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  confirmationSentAt: timestamp("confirmation_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  confirmedAt: timestamp("confirmed_at"),
  seatedAt: timestamp("seated_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  noShowAt: timestamp("no_show_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  date: date("date").notNull().$type<string>(),
  preferredTimeStart: time("preferred_time_start").notNull().$type<string>(),
  preferredTimeEnd: time("preferred_time_end").notNull().$type<string>(),
  partySize: integer("party_size").notNull(),
  status: waitlistStatusEnum("status").notNull().default("waiting"),
  offeredAt: timestamp("offered_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  whatsappThreadId: varchar("whatsapp_thread_id", { length: 100 }),
  status: conversationStatusEnum("status").notNull().default("active"),
  language: languageEnum("language").notNull().default("he"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at"),
  escalatedTo: varchar("escalated_to", { length: 20 }),
});

// ── Growth Tables (schema-ready, not used in Phase 1) ──

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  type: varchar("type", { length: 20 }).notNull(),
  points: integer("points").notNull(),
  reason: text("reason"),
  reservationId: uuid("reservation_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  nameHe: varchar("name_he", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }),
  pointsCost: integer("points_cost").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: varchar("name", { length: 255 }).notNull(),
  templateText: text("template_text").notNull(),
  audienceFilter: jsonb("audience_filter"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  stats: jsonb("stats"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const engagementJobs = pgTable("engagement_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  type: varchar("type", { length: 30 }).notNull(),
  triggerAt: timestamp("trigger_at").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  responseSentiment: varchar("response_sentiment", { length: 10 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).notNull(),
  targetValue: integer("target_value").notNull(),
  rewardPoints: integer("reward_points").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
});

export const feedbackChannelEnum = pgEnum("feedback_channel", [
  "whatsapp",
  "web",
  "sms",
]);

export const visitLogs = pgTable("visit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  date: date("date").notNull().$type<string>(),
  partySize: integer("party_size"),
  items: jsonb("items").$type<
    Array<{ name: string; category: string; price?: number; rating?: number }>
  >(),
  totalSpend: integer("total_spend"),
  feedback: text("feedback"),
  rating: integer("rating"),
  sentiment: text("sentiment"),
  staffNotes: text("staff_notes"),
  occasion: text("occasion"),
  dietaryNotes: jsonb("dietary_notes").$type<{
    vegetarian?: boolean;
    vegan?: boolean;
    glutenFree?: boolean;
    allergies?: string[];
    kosher?: string;
    other?: string;
  }>(),
  channel: feedbackChannelEnum("channel"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challengeProgress = pgTable("challenge_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  currentValue: integer("current_value").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

// ── Reward Claims ──────────────────────────────────────

export const rewardClaimStatusEnum = pgEnum("reward_claim_status", [
  "active",
  "redeemed",
  "expired",
  "cancelled",
]);

export const rewardClaims = pgTable("reward_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  rewardId: uuid("reward_id")
    .notNull()
    .references(() => rewards.id),
  loyaltyTransactionId: uuid("loyalty_transaction_id").references(
    () => loyaltyTransactions.id,
  ),
  claimCode: varchar("claim_code", { length: 20 }).notNull().unique(),
  status: rewardClaimStatusEnum("status").notNull().default("active"),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
  redeemedAt: timestamp("redeemed_at"),
  redeemedBy: uuid("redeemed_by").references(() => adminUsers.id),
  reservationId: uuid("reservation_id").references(() => reservations.id),
});
