import { render } from "preact";
import { BookingWidget } from "./BookingWidget.js";

// Mount function for embed script
function mount(el: HTMLElement, config: { restaurantId: string; apiUrl?: string }) {
  render(<BookingWidget {...config} />, el);
}

// Auto-mount if data attribute present
const el = document.querySelector("[data-openseat-booking]") as HTMLElement;
if (el) {
  mount(el, {
    restaurantId: el.dataset.restaurantId || "",
    apiUrl: el.dataset.apiUrl,
  });
}

// Expose for manual mounting
(window as unknown as Record<string, unknown>).OpenSeatBooking = { mount };
