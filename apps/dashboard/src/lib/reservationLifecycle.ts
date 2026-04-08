import type { Reservation, ReservationStatus } from "@openseat/domain";

export type ReservationSource = Reservation["source"];

export const RESERVATION_TERMINAL_STATUSES: ReservationStatus[] = [
  "completed",
  "cancelled",
  "no_show",
];

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return RESERVATION_TERMINAL_STATUSES.includes(status);
}

export function getAllowedReservationActions(status: ReservationStatus): ReservationStatus[] {
  switch (status) {
    case "pending":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["seated", "cancelled", "no_show"];
    case "seated":
      return ["completed"];
    default:
      return [];
  }
}

export interface ReservationLifecycleEvent {
  key: ReservationStatus;
  timestamp?: string;
}

export function getReservationLifecycleEvents(reservation: Reservation): ReservationLifecycleEvent[] {
  const events: ReservationLifecycleEvent[] = [
    { key: "confirmed", timestamp: reservation.confirmedAt },
    { key: "seated", timestamp: reservation.seatedAt },
    { key: "completed", timestamp: reservation.completedAt },
    { key: "cancelled", timestamp: reservation.cancelledAt },
    { key: "no_show", timestamp: reservation.noShowAt },
  ];

  return events.filter((event): event is ReservationLifecycleEvent & { timestamp: string } => Boolean(event.timestamp));
}

export function getLatestReservationLifecycleEvent(
  reservation: Reservation,
): ReservationLifecycleEvent | undefined {
  return [...getReservationLifecycleEvents(reservation)]
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())[0];
}

export function getReservationSourceTone(source: ReservationSource): string {
  switch (source) {
    case "walk_in":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "phone":
      return "bg-sky-100 text-sky-800 border border-sky-200";
    case "telegram":
      return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    case "whatsapp":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}
