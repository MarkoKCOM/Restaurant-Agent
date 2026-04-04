import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Restaurant,
  Reservation,
  Guest,
  DashboardSnapshot,
  Table,
} from "@sable/domain";

const API = "/api/v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sable_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handle401() {
  localStorage.removeItem("sable_token");
  localStorage.removeItem("sable_restaurant");
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

// --- Restaurant ---

export function useRestaurants() {
  return useQuery<Restaurant[]>({
    queryKey: ["restaurants"],
    queryFn: () => fetchJSON(`${API}/restaurants`),
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
      if (!res.ok) throw new Error(`API error: ${res.status}`);
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
      if (!res.ok) throw new Error(`API error: ${res.status}`);
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
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
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
