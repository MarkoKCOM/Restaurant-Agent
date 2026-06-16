import { createRoot, hydrateRoot } from "react-dom/client";
import { LandingPage, pathToLang } from "./LandingPage.js";
import "./index.css";

// Backward-compat: old ?lang=en / ?lang=ar links now map to the path-based
// prerendered pages. Redirect before rendering so we never hydrate the wrong page.
const params = new URLSearchParams(window.location.search);
const legacy = params.get("lang");
if ((legacy === "en" || legacy === "ar") && pathToLang(window.location.pathname) === "he") {
  window.location.replace(`/${legacy}${window.location.hash}`);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

// Each path ("/", "/en", "/ar") is prerendered in its language; derive the
// initial language from the path so hydration matches the served HTML.
const initialLang = pathToLang(window.location.pathname);

// In production the page is prerendered to static HTML (see scripts/prerender.mjs),
// so #root already contains markup and we hydrate it. In dev the container is
// empty, so we client-render instead.
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <LandingPage initialLang={initialLang} />);
} else {
  createRoot(rootElement).render(<LandingPage initialLang={initialLang} />);
}
