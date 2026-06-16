import { renderToString } from "react-dom/server";
import { LandingPage } from "./LandingPage.js";
import type { Lang } from "./LandingPage.js";

// Used by scripts/prerender.mjs to produce the static HTML for each language
// page ("/", "/en", "/ar") so the full page is crawlable without running
// JavaScript and AI engines can cite OpenSeat in the right language.
export function render(lang: Lang = "he"): string {
  return renderToString(<LandingPage initialLang={lang} />);
}
