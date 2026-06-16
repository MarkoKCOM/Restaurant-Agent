import { createRoot, hydrateRoot } from "react-dom/client";
import { LandingPage } from "./LandingPage.js";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

// In production the page is prerendered to static HTML (see scripts/prerender.mjs),
// so #root already contains markup and we hydrate it. In dev the container is
// empty, so we client-render instead.
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <LandingPage />);
} else {
  createRoot(rootElement).render(<LandingPage />);
}
