import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Restaurant,
  Reservation,
  Guest,
  DashboardSnapshot,
  Table,
} from "@openseat/domain";

const API = "/api/v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("openseat_token");
  const role = localStorage.getItem("openseat_role");
  const storedRestaurant = localStorage.getItem("openseat_restaurant");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  if (role === "super_admin" && storedRestaurant) {
    try {
      const restaurant = JSON.parse(storedRestaurant) as { id?: string };
      if (restaurant.id) {
        headers["X-Restaurant-Id"] = restaurant.id;
      }
    } catch {
      // Ignore broken localStorage and fall back to auth only.
    }
  }

  return headers;
}

function handle401() {
  localStorage.removeItem("openseat_token");
  localStorage.removeItem("openseat_role");
  localStorage.removeItem("openseat_restaurant");
  window.location.href = "/login";
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) { handle401(); throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), "Content-Type": "application/json", ...options.headers },
  });
  if (res.status === 401) { handle401(); throw new Error("Unauthorized"); }
  return res;
}

async function getErrorMessage(res: Response): Promise<string> {
  const payload = await res.json().catch(() => null) as
    | { error?: string; message?: string }
    | null;

  return payload?.error ?? payload?.message ?? `API error: ${res.status}`;
}

// --- Restaurant ---

export interface AdminRestaurantListItem {
  id: string;
  name: string;
  slug: string;
  cuisineType: string | null;
  address: string | null;
  phone: string | null;
  package: string | null;
  createdAt: string;
  adminCount: number;
}

export function useRestaurants() {
  return useQuery<Restaurant[]>({
    queryKey: ["restaurants"],
    queryFn: () => fetchJSON(`${API}/restaurants`),
  });
}

export function useAdminRestaurants() {
  return useQuery<AdminRestaurantListItem[]>({
    queryKey: ["admin-restaurants"],
    queryFn: () => fetchJSON(`${API}/admin/restaurants`),
  });
}

export function useRestaurant(id: string | undefined) {
  return useQuery<Restaurant>({
    queryKey: ["restaurant", id],
    queryFn: () => fetchJSON(`${API}/restaurants/${id}`),
    enabled: !!id,
  });
}

export function useUpdateRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Restaurant> }) => {
      const res = await fetchWithAuth(`${API}/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["restaurant", id] });
    },
  });
}

// --- Dashboard ---

export function useDashboard(restaurantId: string | undefined) {
  return useQuery<DashboardSnapshot>({
    queryKey: ["dashboard", restaurantId],
    queryFn: async () => {
      const data = await fetchJSON<DashboardSnapshot>(
        `${API}/restaurants/${restaurantId}/dashboard`,
      );
      return data;
    },
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });
}

// --- Reservations ---

export function useReservations(params: {
  restaurantId?: string;
  date?: string;
}) {
  const { restaurantId, date } = params;
  const searchParams = new URLSearchParams();
  if (restaurantId) searchParams.set("restaurantId", restaurantId);
  if (date) searchParams.set("date", date);

  return useQuery<Reservation[]>({
    queryKey: ["reservations", restaurantId, date],
    queryFn: async () => {
      const data = await fetchJSON<{ reservations: Reservation[] }>(
        `${API}/reservations?${searchParams}`,
      );
      return data.reservations;
    },
    enabled: !!restaurantId,
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const res = await fetchWithAuth(`${API}/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// --- Guests ---

export function useGuests(restaurantId: string | undefined) {
  return useQuery<Guest[]>({
    queryKey: ["guests", restaurantId],
    queryFn: async () => {
      const data = await fetchJSON<{ guests: Guest[] }>(
        `${API}/guests?restaurantId=${restaurantId}`,
      );
      return data.guests;
    },
    enabled: !!restaurantId,
  });
}

export function useGuest(id: string | undefined) {
  return useQuery<{ guest: Guest; reservations?: Reservation[] }>({
    queryKey: ["guest", id],
    queryFn: () =>
      fetchJSON(`${API}/guests/${id}?includeHistory=true`),
    enabled: !!id,
  });
}

export function useMarkNoShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API}/reservations/${id}/no-show`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// --- Reservations: Cancel ---

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API}/reservations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// --- Create Reservation ---

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      restaurantId: string;
      guestName: string;
      guestPhone: string;
      date: string;
      timeStart: string;
      partySize: number;
      notes?: string;
      source: "phone";
    }) => {
      const res = await fetchWithAuth(`${API}/reservations`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      restaurantId: string;
      guestName: string;
      guestPhone: string;
      date: string;
      timeStart: string;
      partySize: number;
      notes?: string;
      seatImmediately?: boolean;
    }) => {
      const res = await fetchWithAuth(`${API}/reservations/walk-in`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tableStatus"] });
    },
  });
}

// --- Table Status ---

export interface TableStatusItem {
  tableId: string;
  tableName: string;
  seats: number;
  status: "available" | "reserved" | "occupied";
  reservation?: {
    id: string;
    guestName: string;
    partySize: number;
    timeStart: string;
  };
}

export function useTableStatus(restaurantId: string | undefined) {
  return useQuery<TableStatusItem[]>({
    queryKey: ["tableStatus", restaurantId],
    queryFn: () =>
      fetchJSON(`${API}/restaurants/${restaurantId}/table-status`),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });
}

// --- Tables ---

export function useTables(restaurantId: string | undefined) {
  return useQuery<Table[]>({
    queryKey: ["tables", restaurantId],
    queryFn: () =>
      fetchJSON(`${API}/restaurants/${restaurantId}/tables`),
    enabled: !!restaurantId,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      restaurantId: string;
      name: string;
      minSeats: number;
      maxSeats: number;
      zone?: string;
    }) => {
      const res = await fetchWithAuth(`${API}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tables", variables.restaurantId] });
    },
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Table>;
    }) => {
      const res = await fetchWithAuth(`${API}/tables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API}/tables/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

// --- Guest Update ---

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Guest> }) => {
      const res = await fetchWithAuth(`${API}/guests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["guest", id] });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}

// --- Guest Preferences ---

export interface GuestPreferences {
  dietary: string[];
  seating: string;
  language: string;
  notes: string;
}

export function useUpdateGuestPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GuestPreferences }) => {
      const res = await fetchWithAuth(`${API}/guests/${id}/preferences`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["guest", id] });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}

// --- Loyalty ---

export interface LoyaltyBalance {
  points: number;
  tier: string;
  stampCard: {
    visits: number;
    stampsNeeded: number;
    stampsUntilReward: number;
    earned: number;
  };
}

export interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  description: string;
  createdAt: string;
}

export function useLoyaltyBalance(guestId: string | undefined) {
  return useQuery<LoyaltyBalance>({
    queryKey: ["loyalty-balance", guestId],
    queryFn: () => fetchJSON(`${API}/loyalty/${guestId}/balance`),
    enabled: !!guestId,
    retry: false,
  });
}

export function useLoyaltyHistory(guestId: string | undefined) {
  return useQuery<{ transactions: LoyaltyTransaction[] }>({
    queryKey: ["loyalty-history", guestId],
    queryFn: () => fetchJSON(`${API}/loyalty/${guestId}/history`),
    enabled: !!guestId,
    retry: false,
  });
}

// --- Visit Insights ---

export interface VisitInsights {
  favoriteItems?: string[];
  dietaryProfile?: string[];
  visitFrequency?: string;
}

export function useVisitInsights(guestId: string | undefined) {
  return useQuery<VisitInsights>({
    queryKey: ["visit-insights", guestId],
    queryFn: () => fetchJSON(`${API}/visits/${guestId}/insights`),
    enabled: !!guestId,
    retry: false,
  });
}

// --- Waitlist ---

export interface WaitlistEntry {
  id: string;
  restaurantId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  partySize: number;
  status: "waiting" | "offered" | "accepted" | "expired";
  offeredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function useWaitlist(restaurantId: string | undefined, date?: string) {
  const searchParams = new URLSearchParams();
  if (restaurantId) searchParams.set("restaurantId", restaurantId);
  if (date) searchParams.set("date", date);

  return useQuery<WaitlistEntry[]>({
    queryKey: ["waitlist", restaurantId, date],
    queryFn: async () => {
      const data = await fetchJSON<{ waitlist: WaitlistEntry[] }>(
        `${API}/waitlist?${searchParams}`,
      );
      return data.waitlist;
    },
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });
}

export function useAddToWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      restaurantId: string;
      guestName: string;
      guestPhone: string;
      date: string;
      preferredTimeStart: string;
      preferredTimeEnd: string;
      partySize: number;
    }) => {
      const res = await fetchWithAuth(`${API}/waitlist`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
        throw new Error(err.error ?? err.message ?? `API error: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
}

export function useOfferSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API}/waitlist/${id}/offer`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
}

export function useAcceptOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API}/waitlist/${id}/accept`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`${API}/waitlist/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
}

// --- Testing ---

export function useResetReservations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (restaurantId: string) => {
      const res = await fetchWithAuth(`${API}/restaurants/${restaurantId}/reset-reservations`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tableStatus"] });
    },
  });
}
