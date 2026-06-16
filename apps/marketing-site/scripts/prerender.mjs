// Post-build prerender step (Static Site Generation).
//
// The marketing site is a client-rendered React SPA, which means crawlers and
// AI answer engines that do not execute JavaScript would otherwise see an empty
// <div id="root">. This script renders the app to static HTML at build time and
// injects it into dist/index.html, so the full marketing copy, FAQ, and stats
// are present in the initial HTML response (GEO: generative engine optimization).
//
// Pipeline (see package.json "build"):
//   1. vite build                         -> dist/ (client bundle + index.html)
//   2. vite build --ssr entry-server      -> dist-server/entry-server.js
//   3. node scripts/prerender.mjs         -> inject render() output into #root

import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const indexPath = resolve(appRoot, "dist/index.html");
const serverEntry = resolve(appRoot, "dist-server/entry-server.js");

const ROOT_RE = /<div id="root">\s*<\/div>/;

async function main() {
  const { render } = await import(serverEntry);
  const appHtml = render();

  const template = await readFile(indexPath, "utf8");
  if (!ROOT_RE.test(template)) {
    throw new Error('prerender: could not find an empty <div id="root"></div> in dist/index.html');
  }

  const out = template.replace(ROOT_RE, `<div id="root">${appHtml}</div>`);
  await writeFile(indexPath, out, "utf8");

  // The server bundle is only needed for this step.
  await rm(resolve(appRoot, "dist-server"), { recursive: true, force: true });

  const kb = (out.length / 1024).toFixed(1);
  console.log(`prerender: injected ${(appHtml.length / 1024).toFixed(1)} kB of static HTML into #root (index.html is now ${kb} kB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
