# Marketing Site — Launch & GEO Checklist

Human-only actions to finish launching the OpenSeat marketing site for SEO + GEO
(Generative Engine Optimization). Everything in **Already done** ships automatically;
the **Your to-do** items need your accounts/decisions and can't be automated.

Last updated: 2026-06-16

---

## 🔴 Your to-do (blocks the rest)

### 1. Point the real domain (highest priority — unlocks everything below)
- [ ] Register / choose the production domain (e.g. `openseat.co`).
- [ ] Add it to the `marketing-site` project in Vercel → **Settings → Domains**.
- [ ] Add a Production env var **`SITE_ORIGIN=https://yourdomain.com`** (Vercel → Settings → Environment Variables), then **redeploy**.
      - The build rewrites every canonical, Open Graph, hreflang, JSON-LD, `sitemap.xml`, and `robots.txt` URL to this value. **No code change needed.**
- [ ] Ping the team/agent with the domain so the deploy + live URLs (`/`, `/en`, `/ar`) get re-verified.

> Until this is done, all SEO/GEO signals point at the throwaway `marketing-site-nine-chi.vercel.app` URL, and search/AI engines will index that instead of the brand.

### 2. Submit to search engines (after the domain is live)
- [ ] **Google Search Console**: add the property, verify ownership (DNS TXT, or request the HTML meta-tag method and hand the code to the agent to wire in), submit `https://yourdomain.com/sitemap.xml`.
- [ ] **Bing Webmaster Tools**: add the site (or import from Search Console), submit the sitemap.
- [ ] Confirm all three language URLs are indexable (`/`, `/en`, `/ar`).

### 3. GEO citation monitoring (after the domain is live)
- [ ] Pick target queries in each language, e.g.:
      - HE: "מערכת הזמנות ומועדון לקוחות למסעדות"
      - EN: "restaurant reservation and membership system Israel"
      - AR: "نظام حجوزات ونادي ولاء للمطاعم"
- [ ] Periodically prompt ChatGPT / Perplexity / Gemini / Google AI Overviews with them and record whether OpenSeat is cited and how it's described.
- [ ] (Optional) ask the agent to script a recurring check once the domain is live.

### 4. Branding sign-off (optional)
- [ ] Confirm the OG share image and favicon render correctly when sharing the new domain on WhatsApp / X / LinkedIn (social caches may take time to refresh).

---

## ✅ Already done (automated — no action needed)

- [x] Brand bundle applied: logo, favicons, Apple touch icon, PWA manifest, OG image (#28).
- [x] Responsive section spacing; mobile reviewed across RTL/LTR (#32).
- [x] **Prerendering (SSG)** — real HTML is in the initial response for AI crawlers that don't run JS (GPTBot, PerplexityBot, ClaudeBot, OAI-SearchBot) (#32).
- [x] **Per-language pages** `/`, `/en`, `/ar`, each with localized `<html lang/dir>`, title, description, Open Graph, and a self-referencing canonical; path-based reciprocal hreflang; multilingual sitemap (#44).
- [x] **Structured data**: Organization, SoftwareApplication, FAQPage, WebSite, WebPage, HowTo, Product (with pricing).
- [x] **AI crawlers explicitly allowed** in `robots.txt` (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot, …).
- [x] **`SITE_ORIGIN`** makes the domain swap a one-env-var change; `dateModified` + sitemap `lastmod` auto-stamp to each build date (#48).

---

## Reference

- Domain swap mechanism: `apps/marketing-site/scripts/prerender.mjs` (`SITE_ORIGIN`).
- Vercel routing: `apps/marketing-site/vercel.json` (`cleanUrls`, `trailingSlash:false`).
- Per-page metadata + localized copy: the `META` map in `scripts/prerender.mjs` (keep in sync with the in-app i18n in `src/LandingPage.tsx`).
