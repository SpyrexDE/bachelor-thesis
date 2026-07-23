// Gate 4: every hand-maintained concept anchor (concept_anchors.js) appears
// VERBATIM in the source PDF AND its `contains` claim exists in the generated
// concept.gen.js. Protects the "verified" overrides from typos/hallucination.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { SOURCES } from "../claims.js";
import { CONCEPT_ANCHORS } from "../concept_anchors.js";
import { CONCEPT_DOCS } from "../concept.gen.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const alnum = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const allHtml = CONCEPT_DOCS.map(d => d.html).join("\n");
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
const plain = allHtml.replace(/<[^>]+>/g, "");
for (const a of CONCEPT_ANCHORS) {
  const src = SOURCES[a.src];
  if (a.quote) {
    // external quote: no PDF, does the contains claim match (rendered as quoted)?
    if (src?.pdf) { console.log(`FAIL ${a.src}: quote entry, but the source has a PDF`); fail++; continue; }
    if (!(allHtml.includes(`data-status="quoted"`) && plain.includes(a.contains))) {
      console.log(`FAIL ${a.src}: quote-contains "${a.contains.slice(0, 40)}" not found as a claim`); fail++; continue; }
    ok++; continue;
  }
  if (!src?.pdf) { console.log(`FAIL ${a.src}: no PDF (a needle override makes no sense)`); fail++; continue; }
  // 1) passage verbatim in the PDF?
  const flat = await flatOf(src.pdf);
  if (!flat.includes(alnum(a.needle))) { console.log(`FAIL ${a.src}: passage not in PDF: "${a.needle.slice(0, 60)}"`); fail++; continue; }
  // 2) does the hand link match (contains claim in the document, rendered as linked)?
  if (!(allHtml.includes(`data-status="linked"`) && plain.includes(a.contains))) {
    console.log(`FAIL ${a.src}: contains "${a.contains.slice(0, 40)}" not found as a claim`); fail++; continue; }
  ok++;
}
console.log(fail ? `\n${fail} FAIL (${ok} ok)` : `\nCONCEPT ANCHORS GREEN — all ${ok} override passages verbatim + matching`);
process.exit(fail ? 1 : 0);
