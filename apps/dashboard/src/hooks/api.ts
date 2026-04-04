import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Restaurant,
  Reservation,
  Guest,
  DashboardSnapshot,
  Table,
} from "@sable/domain";

const API = "/api/v1";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
      const res = await fetch(`${API}/restaurants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
  return useQuery<DashboardSnapshot["today"]>({
    queryKey: ["dashboard", restaurantId],
    queryFn: async () => {
      const data = await fetchJSON<{ today: DashboardSnapshot["today"] }>(
        `${API}/restaurants/${restaurantId}/dashboard`,
      );
      return data.today;
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
      const res = await fetch(`${API}/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

// --- Tables ---

export function useTables(restaurantId: string | undefined) {
  return useQuery<Table[]>({
    queryKey: ["tables", restaurantId],
    queryFn: () =>
      fetchJSON(`${API}/restaurants/${restaurantId}/tables`),
    enabled: !!restaurantId,
  });
}
