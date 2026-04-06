import { useAuth } from "./useAuth.js";
import { useRestaurant } from "./api.js";
import type { Restaurant } from "@openseat/domain";

/**
 * Returns the current restaurant.
 * Uses auth context for the restaurant ID, then fetches full restaurant
 * data from the API so all fields (phone, address, hours, etc.) are available.
 */
export function useCurrentRestaurant() {
  const { restaurant: authRestaurant } = useAuth();
  const restaurantId = authRestaurant?.id;

  const { data: fullRestaurant, isLoading, error } = useRestaurant(restaurantId);

  // Always return the full Restaurant from API when available.
  // While loading, return undefined (pages should handle isLoading).
  const restaurant: Restaurant | undefined = fullRestaurant ?? undefined;

  return {
    restaurant,
    isLoading: restaurantId ? isLoading : false,
    error,
  };
}
