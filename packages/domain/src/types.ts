// Core domain types shared across all apps

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  cuisineType?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  locale: string;
  operatingHours?: OperatingHours;
  package: "starter" | "growth";
  widgetConfig?: WidgetConfig;
  dashboardConfig?: DashboardConfig;
}

export interface OperatingHours {
  [day: string]: { open: string; close: string } | null;
}

export interface WidgetConfig {
  primaryColor?: string;
  logo?: string;
  welcomeText?: string;
}

export interface DashboardConfig {
  accentColor?: string;
  logo?: string;
  language?: "he" | "en";
  visiblePages?: string[];
  features?: {
    waitlist?: boolean;
    loyalty?: boolean;
    guestNotes?: boolean;
    occupancyHeatmap?: boolean;
    tableMap?: boolean;
  };
}

export interface Table {
  id: string;
  restaurantId: string;
  name: string;
  minSeats: number;
  maxSeats: number;
  zone?: string;
  combinableWith?: string[];
  isActive: boolean;
}

export interface GuestPreferences {
  dietary: string[];
  seating: string;
  language: string;
  notes: string;
}

export interface Guest {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  language: "he" | "en" | "ar" | "ru";
  source: "whatsapp" | "web" | "walk_in" | "referral" | "telegram";
  visitCount: number;
  noShowCount: number;
  tier: "bronze" | "silver" | "gold";
  preferences?: GuestPreferences | Record<string, unknown>;
  tags?: string[];
  notes?: string;
}

export interface Reservation {
  id: string;
  restaurantId: string;
  guestId: string;
  date: string;
  timeStart: string;
  timeEnd?: string;
  partySize: number;
  tableIds?: string[];
  status: ReservationStatus;
  source: "whatsapp" | "web" | "walk_in" | "phone" | "telegram";
  notes?: string;
  guest?: Guest;
  confirmedAt?: string;
  seatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  noShowAt?: string;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export interface WaitlistEntry {
  id: string;
  restaurantId: string;
  guestId: string;
  date: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  partySize: number;
  status: "waiting" | "offered" | "accepted" | "expired";
}

export interface AvailabilitySlot {
  time: string;
  availableTables: number;
  maxPartySize: number;
}

export interface DashboardSnapshot {
  today: {
    reservations: number;
    covers: number;
    cancellations: number;
    noShows: number;
  };
  upcoming: Reservation[];
  occupancyByHour: Record<string, number>;
}
