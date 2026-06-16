import { renderToString } from "react-dom/server";
import { LandingPage } from "./LandingPage.js";

// Used by scripts/prerender.mjs to produce the static HTML that gets injected
// into dist/index.html so the full page is crawlable without running JavaScript.
export function render(): string {
  return renderToString(<LandingPage />);
}
