import { useRestaurants } from "./api.js";

/**
 * Returns the current restaurant (first one for now — single-tenant MVP).
 */
export function useCurrentRestaurant() {
  const { data: restaurants, isLoading, error } = useRestaurants();
  return {
    restaurant: restaurants?.[0],
    isLoading,
    error,
  };
}
