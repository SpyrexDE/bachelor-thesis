// Offline gate: checks EVERY needle against the real PDF before the UI uses it.
// PASS = needle found verbatim in the text layer (page is reported).
// FAIL = needle missing -> prints context around the longest needle word so the
//        needle can be corrected against the REAL text (never guessed).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { SOURCES, CLAIMS, LOGCLAIMS } from "../claims.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const alnum = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pageCache = new Map(); // pdfPath -> [{page, text}]

async function pagesOf(pdfPath) {
  if (pageCache.has(pdfPath)) return pageCache.get(pdfPath);
  const doc = await getDocument({ data: new Uint8Array(readFileSync(join(root, pdfPath))) }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    out.push({ page: p, text: alnum(tc.items.map(i => i.str).join("")) });
  }
  pageCache.set(pdfPath, out);
  return out;
}

let fail = 0;
for (const [id, c] of Object.entries({ ...CLAIMS, ...LOGCLAIMS })) {
  const src = SOURCES[c.key];
  if (!src.pdf || !c.needle) { console.log(`SKIP  ${id.padEnd(20)} ${!src.pdf ? "no PDF" : "no needle"} (link: ${src.url || "-"})`); continue; }
  const pages = await pagesOf(src.pdf);
  const needle = alnum(c.needle);
  const hit = pages.find(p => p.text.includes(needle));
  if (hit) { console.log(`PASS  ${id.padEnd(20)} ${src.pdf.split("/").pop()} S.${hit.page}`); continue; }
  fail++;
  console.log(`FAIL  ${id.padEnd(20)} ${src.pdf.split("/").pop()} — needle not found: "${c.needle}"`);
  const anchor = alnum(c.needle.split(/\s+/).sort((a, b) => b.length - a.length)[0]);
  for (const p of pages) {
    const i = p.text.indexOf(anchor);
    if (i >= 0) { console.log(`      context p.${p.page}: …${p.text.slice(Math.max(0, i - 60), i + 140)}…`); break; }
  }
}
console.log(fail ? `\n${fail} FAIL` : "\nALL NEEDLES GREEN");
process.exit(fail ? 1 : 0);
