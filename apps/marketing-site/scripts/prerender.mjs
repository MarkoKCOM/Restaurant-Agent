// Post-build prerender step (Static Site Generation), per language.
//
// The marketing site is a client-rendered React SPA, and AI answer engines
// (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, ...) do NOT execute
// JavaScript — they read the raw HTML. So we render the app to static HTML at
// build time, once per language, and emit a distinct, self-canonical page:
//
//   dist/index.html       -> Hebrew  (canonical "/")
//   dist/en/index.html    -> English (canonical "/en")
//   dist/ar/index.html    -> Arabic  (canonical "/ar")
//
// Each page gets a localized <html lang/dir>, <title>, description, Open Graph,
// and a self-referencing canonical, while the hreflang block (already path-based
// in index.html) is shared and reciprocal across all three. This is what makes
// the multilingual signaling coherent: Google only honors hreflang when the
// canonical is self-referencing.
//
// Pipeline (see package.json "build"):
//   1. vite build                    -> dist/ (client bundle + index.html template)
//   2. vite build --ssr entry-server -> dist-server/entry-server.js
//   3. node scripts/prerender.mjs    -> this file

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const distDir = resolve(appRoot, "dist");
const templatePath = resolve(distDir, "index.html");
const serverEntry = resolve(appRoot, "dist-server/entry-server.js");

const ORIGIN = "https://marketing-site-nine-chi.vercel.app";
const ROOT_RE = /<div id="root">\s*<\/div>/;

// Per-language head metadata. Keep these in sync with the in-app i18n copy.
const META = {
  he: {
    dir: "rtl",
    locale: "he_IL",
    path: "/",
    out: "index.html",
    title: "OpenSeat - הזמנות, וואטסאפ ומועדון חברים למסעדות | Reservations & Membership Club",
    description: "OpenSeat - הזמנות אונליין, ספר אורחים ומועדון חברים למסעדות. עובד בוואטסאפ, באתר שלך ועל כל טאבלט עם דשבורד white-label לבעלים.",
    ogTitle: "OpenSeat - חבר הצוות הכי חכם של המסעדה שלך",
    ogDescription: "הזמנות אונליין, ספר אורחים ומועדון חברים למסעדות. עובד בוואטסאפ, באתר שלך ועל כל טאבלט.",
  },
  en: {
    dir: "ltr",
    locale: "en_US",
    path: "/en",
    out: "en/index.html",
    title: "OpenSeat - restaurant reservations, guest book & membership club on WhatsApp",
    description: "OpenSeat is a guest-retention platform for restaurants: online reservations, a digital guest book, and a WhatsApp membership club. Works on WhatsApp, a website widget, and a white-label dashboard on any tablet.",
    ogTitle: "OpenSeat - your restaurant's smartest team member",
    ogDescription: "Reservations, guest book, and a restaurant membership club on WhatsApp, your website, and any tablet.",
  },
  ar: {
    dir: "rtl",
    locale: "ar_SA",
    path: "/ar",
    out: "ar/index.html",
    title: "OpenSeat - حجوزات المطاعم ودفتر الضيوف ونادي العضوية عبر واتساب",
    description: "OpenSeat منصة للحفاظ على الضيوف للمطاعم: حجوزات عبر الإنترنت، ودفتر ضيوف رقمي، ونادي عضوية عبر واتساب. تعمل عبر واتساب، وأداة على موقعك، ولوحة تحكم بعلامتك على أي جهاز لوحي.",
    ogTitle: "OpenSeat - أذكى عضو في فريق مطعمك",
    ogDescription: "حجوزات ودفتر ضيوف ونادي عضوية للمطاعم عبر واتساب وموقعك وأي جهاز لوحي.",
  },
};

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Replace the single tag/meta matching `re` with `replacement`, asserting it existed.
function sub(html, re, replacement, label) {
  if (!re.test(html)) throw new Error(`prerender: pattern not found for ${label}`);
  return html.replace(re, replacement);
}

function buildPage(template, lang, appHtml) {
  const m = META[lang];
  const url = ORIGIN + m.path;
  let html = template;

  html = sub(html, /<html[^>]*>/, `<html lang="${lang}" dir="${m.dir}">`, "html tag");
  html = sub(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`, "title");
  html = sub(
    html,
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${esc(m.description)}" />`,
    "description",
  );
  html = sub(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
    "canonical",
  );
  html = sub(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${esc(m.ogTitle)}" />`,
    "og:title",
  );
  html = sub(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${esc(m.ogDescription)}" />`,
    "og:description",
  );
  html = sub(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${url}" />`,
    "og:url",
  );
  html = sub(
    html,
    /<meta property="og:locale" content="[^"]*"\s*\/>/,
    `<meta property="og:locale" content="${m.locale}" />`,
    "og:locale",
  );
  // WebPage structured-data language signal (string form is unique to WebPage).
  html = html.replace(/"inLanguage": "he"/, `"inLanguage": "${lang}"`);

  html = html.replace(ROOT_RE, `<div id="root">${appHtml}</div>`);
  return html;
}

async function main() {
  const { render } = await import(serverEntry);
  const template = await readFile(templatePath, "utf8");
  if (!ROOT_RE.test(template)) {
    throw new Error('prerender: could not find an empty <div id="root"></div> in dist/index.html');
  }

  for (const lang of Object.keys(META)) {
    const appHtml = render(lang);
    const page = buildPage(template, lang, appHtml);
    const outPath = resolve(distDir, META[lang].out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, page, "utf8");
    console.log(`prerender: ${lang} -> ${META[lang].out} (${(page.length / 1024).toFixed(1)} kB)`);
  }

  await rm(resolve(appRoot, "dist-server"), { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
