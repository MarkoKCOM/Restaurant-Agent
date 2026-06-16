import { tableRepository } from "../repositories/table.repository.js";

export type { TableRow } from "../repositories/table.repository.js";
import type { TableRow } from "../repositories/table.repository.js";

export async function getActiveTablesForRestaurant(restaurantId: string): Promise<TableRow[]> {
  return tableRepository.findActiveByRestaurant(restaurantId);
}

export async function listTables(params: {
  restaurantId?: string;
  includeInactive?: boolean;
}): Promise<TableRow[]> {
  const { restaurantId, includeInactive } = params;
  const includeInactiveBool = !!includeInactive;

  if (restaurantId) {
    return tableRepository.findByRestaurant(restaurantId, {
      includeInactive: includeInactiveBool,
    });
  }

  return tableRepository.findAll({ includeInactive: includeInactiveBool });
}

export async function createTable(input: {
  restaurantId: string;
  name: string;
  minSeats: number;
  maxSeats: number;
  zone?: string;
  combinableWith?: string[];
}): Promise<TableRow> {
  return tableRepository.insert({
    restaurantId: input.restaurantId,
    name: input.name,
    minSeats: input.minSeats,
    maxSeats: input.maxSeats,
    zone: input.zone,
    combinableWith: input.combinableWith,
    isActive: true,
  });
}

export async function updateTable(
  id: string,
  restaurantId: string,
  updates: Partial<{
    name: string;
    minSeats: number;
    maxSeats: number;
    zone?: string;
    combinableWith?: string[];
    isActive: boolean;
  }>,
): Promise<TableRow | null> {
  if (Object.keys(updates).length === 0) {
    return tableRepository.findById(id, restaurantId);
  }

  return tableRepository.update(id, restaurantId, updates);
}

export async function deactivateTable(id: string, restaurantId: string): Promise<void> {
  await tableRepository.deactivate(id, restaurantId);
}

export function pickBestTablesForParty(
  availableTables: TableRow[],
  partySize: number,
): string[] | null {
  if (availableTables.length === 0) return null;

  const singleTableCandidates = availableTables.filter(
    (t) => partySize >= t.minSeats && partySize <= t.maxSeats,
  );

  if (singleTableCandidates.length > 0) {
    singleTableCandidates.sort((a, b) => a.maxSeats - b.maxSeats);
    return [singleTableCandidates[0].id];
  }

  let bestCombo: { ids: string[]; capacity: number } | null = null;

  for (let i = 0; i < availableTables.length; i++) {
    for (let j = i + 1; j < availableTables.length; j++) {
      const t1 = availableTables[i];
      const t2 = availableTables[j];

      const minSeats = t1.minSeats + t2.minSeats;
      const maxSeats = t1.maxSeats + t2.maxSeats;

      if (partySize < minSeats || partySize > maxSeats) continue;

      if (!bestCombo || maxSeats < bestCombo.capacity) {
        bestCombo = { ids: [t1.id, t2.id], capacity: maxSeats };
      }
    }
  }

  return bestCombo?.ids ?? null;
}
