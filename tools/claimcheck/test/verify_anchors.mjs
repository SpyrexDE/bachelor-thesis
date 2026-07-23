// Gate 3: every cite jump target (ANCHORS[cix]) appears VERBATIM in the source PDF
// of that cite. Catches broken/hallucinated anchors before shipping.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { SOURCES } from "../claims.js";
import { CITECTX } from "../content.gen.js";
import { ANCHORS } from "../anchors.gen.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const alnum = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const flatCache = new Map();
async function flatOf(pdf) {
  if (flatCache.has(pdf)) return flatCache.get(pdf);
  let raw = "";
  try {
    const doc = await getDocument({ data: new Uint8Array(readFileSync(join(root, pdf))) }).promise;
    for (let p = 1; p <= doc.numPages; p++)
      raw += " " + (await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join(" ");
  } catch {}
  const flat = alnum(raw.replace(/-\s+/g, ""));
  flatCache.set(pdf, flat);
  return flat;
}

let fail = 0, ok = 0;
for (const [cix, quote] of Object.entries(ANCHORS)) {
  const ctx = CITECTX[cix];
  const src = ctx && SOURCES[ctx.key];
  if (!src?.pdf) { console.log(`FAIL cix ${cix}: no PDF for ${ctx?.key}`); fail++; continue; }
  const flat = await flatOf(src.pdf);
  if (flat.includes(alnum(quote))) ok++;
  else { console.log(`FAIL cix ${cix} (${ctx.key}): anchor not in PDF: "${quote.slice(0, 60)}"`); fail++; }
}
console.log(fail ? `\n${fail} FAIL (${ok} ok)` : `\nANCHORS GREEN — all ${ok} jump targets verbatim in their PDF`);
process.exit(fail ? 1 : 0);
