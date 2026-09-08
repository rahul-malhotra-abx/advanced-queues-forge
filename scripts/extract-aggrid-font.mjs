#!/usr/bin/env node
// Trap 14 — Forge's font-src is 'self' plus Atlassian hosts, with NO `data:`.
//
// ag-Grid's balham theme embeds its icon font as a base64 data URI, so the
// browser blocks it and every glyph (sort arrows, checkboxes, expand carets,
// the column menu) silently renders as nothing. The console error names a 30 kB
// base64 blob and reads as if it has nothing to do with ag-Grid.
//
// Extract it to a real same-origin file; grid.component.scss re-declares the
// family after the theme import, since for a given family the last @font-face
// wins. Re-run this after any ag-Grid upgrade.
//
//   node scripts/extract-aggrid-font.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UI = join(dirname(fileURLToPath(import.meta.url)), "..", "static", "forge-angular-app");
const THEME = join(UI, "node_modules/ag-grid-community/dist/styles/ag-theme-balham.min.css");

const css = readFileSync(THEME, "utf8");
const m = /@font-face\{font-family:(\w+);src:url\("data:application\/font-(woff2?);charset=utf-8;base64,([A-Za-z0-9+/=]+)"\)/.exec(css);
if (!m) {
  console.error(`No embedded @font-face in ${THEME}.`);
  console.error("Either ag-Grid stopped inlining it (good — drop the @font-face override in");
  console.error("grid.component.scss) or the pattern changed. Check before assuming.");
  process.exit(1);
}

const [, family, ext, b64] = m;
const bytes = Buffer.from(b64, "base64");
mkdirSync(join(UI, "src/assets/fonts"), { recursive: true });
const out = join(UI, "src/assets/fonts", `${family}.${ext}`);
writeFileSync(out, bytes);

console.log(`family=${family} format=${ext} bytes=${bytes.length}`);
console.log(`wrote static/forge-angular-app/src/assets/fonts/${family}.${ext}`);
console.log("\nVerify after building:");
console.log("  grep -c 'url(data:application/font' static/forge-angular-app/dist/advanced-queues/*.js  # expect 0");
