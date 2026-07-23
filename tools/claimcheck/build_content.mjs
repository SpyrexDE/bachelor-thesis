// Generates content.gen.js from the .tex drafts: the whole paper as HTML,
// claim sentences linked via the % [card:<id>] tags, plus a hash per claim
// (sentence + needle + source). If any of these change, the UI invalidates the check.
// Usage: node build_content.mjs [drafts-dir]   (default: ~/Documents/dev/bachelors-thesis-drafts)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { CLAIMS, LOGCLAIMS, SOURCES } from "./claims.js";

const here = dirname(fileURLToPath(import.meta.url));
const draftsDir = process.argv[2] || join(process.env.HOME, "Documents/dev/bachelors-thesis-drafts");
const FILES = [
  ["chapter-01-introduction-draft.tex",      "1 · Introduction"],
  ["chapter-02-background-draft.tex",        "2 · Background and Related Work"],
  ["design-space-section-draft.tex",         "Design-Space Sections (→ 2.1 / 3.x)"],
  ["chapter-03-design-draft.tex",            "3 · Design"],
  ["chapter-04-implementation-draft.tex",    "4 · Implementation"],
  ["chapter-05-evaluation-method-draft.tex", "5 · Evaluation Method"],
  ["chapter-06-results-skeleton.tex",        "6 · Results"],
  ["chapter-07-discussion-draft.tex",        "7 · Discussion"],
  ["chapter-08-conclusion-skeleton.tex",     "8 · Conclusion"],
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sha = s => createHash("sha1").update(s).digest("hex").slice(0, 12);

// TeX line -> plain text. Order matters: commands WITH an argument come
// FIRST (before braces are stripped), otherwise \cmd swallows the argument.
function detex(line) {
  let t = line;
  // commands with a single argument (keep the content, with markup where relevant)
  t = t.replace(/\\(?:textbf|strong)\{([^{}]*)\}/g, "**$1**");
  t = t.replace(/\\(?:emph|textit|textsc)\{([^{}]*)\}/g, "*$1*");
  t = t.replace(/\\(?:texttt|verb|path)\|?\{([^{}]*)\}/g, "$1");
  t = t.replace(/\\cite[tp]?\{([^{}]*)\}/g, (_, k) => `⟦${k}⟧`);
  t = t.replace(/\\(?:C|c)?ref\{([^{}]*)\}/g, "(→$1)");
  t = t.replace(/\\url\{([^{}]*)\}/g, "$1");
  t = t.replace(/\\(?:label|caption|graphicspath|hypersetup|input)\{[^{}]*\}/g, "");
  // symbols before the generic command stripping
  t = t.replace(/``/g, "“").replace(/''/g, "”");
  t = t.replace(/\\times/g, "×").replace(/\\rightarrow/g, "→").replace(/\\ldots|\\dots/g, "…");
  t = t.replace(/\\%/g, "%").replace(/\\&/g, "&").replace(/\\_/g, "_").replace(/\\#/g, "#").replace(/\\\$/g, "$");
  t = t.replace(/\\,|\\;|\\:|\\!|\\ /g, " ");
  t = t.replace(/\$([^$]*)\$/g, "$1");
  t = t.replace(/\\\\/g, " ");
  // remaining commands with an argument: keep the content; without an argument: remove
  t = t.replace(/\\[a-zA-Z]+\*?\{([^{}]*)\}/g, "$1");
  t = t.replace(/\\[a-zA-Z]+\*?/g, "");
  // leftovers
  t = t.replace(/[{}]/g, "").replace(/(?<!\\)~/g, " ");
  return t.replace(/[ \t]+/g, " ");
}

const sections = [];
const placements = new Map();   // cid -> {sentence}
const taggedUnknown = new Set();
const citeContexts = [];        // cix -> { key, sentence } for anchor verification
let cix = 0;
let cur = null;

function flushPara(para, tags) {
  if (!para.trim() && !tags.length) return;
  let text = para.replace(/\s+/g, " ").trim();
  if (!text) { tags.length = 0; return; }
  // sentences with offsets
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z“(⟦*])/);
  const bounds = []; let off = 0;
  for (const p of parts) { bounds.push([off, off + p.length]); off += p.length + 1; }
  // tags -> sentence
  const wraps = new Map(); // sentIdx -> [cids]
  for (const { ids, at } of tags) {
    let si = bounds.findIndex(([a, b]) => at >= a && at <= b);
    if (si < 0) si = bounds.length - 1;
    for (const id of ids) {
      if (LOGCLAIMS[id]) { (wraps.get(si) ?? wraps.set(si, []).get(si)).push(id); continue; }
      if (!CLAIMS[id]) { taggedUnknown.add(id); continue; }
      (wraps.get(si) ?? wraps.set(si, []).get(si)).push(id);
      if (!placements.has(id)) placements.set(id, parts[si]);
    }
  }
  const html = parts.map((p, i) => {
    const sent = p.replace(/⟦[^⟧]*⟧/g, "").replace(/[*]+/g, "").replace(/\s+/g, " ").trim();
    let h = esc(p)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replace(/⟦([^⟧]*)⟧/g, (_, k) => k.split(",").map(x => x.trim()).map(x => {
        if (!SOURCES[x]) return `<span class="cite">[${x}]</span>`;
        const ci = cix++; citeContexts[ci] = { key: x, sentence: sent };
        return `<a class="cite" data-src="${x}" data-cix="${ci}">[${x}]</a>`;
      }).join(""));
    const ids = wraps.get(i) || [];
    if (ids.length) {
      const cls = LOGCLAIMS[ids[0]] ? ' class="ref"' : "";
      h = `<c${cls} data-cid="${ids[0]}">${h}</c>` +
          ids.slice(1).map(id => ` <c class="chip${LOGCLAIMS[id] ? " ref" : ""}" data-cid="${id}" title="${id}">°</c>`).join("");
    }
    return h;
  }).join(" ");
  cur.paras.push("<p>" + html + "</p>");
  tags.length = 0;
}

for (const [f, ftitle] of FILES) {
  const path = join(draftsDir, f);
  if (!existsSync(path)) { console.error("MISSING:", path); continue; }
  cur = { title: ftitle, paras: [] };
  sections.push(cur);
  let para = ""; const tags = [];
  let inTable = false, inEq = false;

  for (const raw of readFileSync(path, "utf8").split("\n")) {
    // collect tags (also from comment fragments), then strip the comment
    const ids = [...raw.matchAll(/\[card:([a-z0-9-]+)\]/g)].map(m => m[1]);
    const code = raw.replace(/(?<!\\)%.*$/, "");
    const isStructural = /\\(?:begin|end)\{(?:table|tabularx|equation)\}/.test(code);
    if (/\\begin\{(?:table|tabularx)/.test(code)) { flushPara(para, tags); para = ""; inTable = true; }
    if (/\\begin\{equation\}/.test(code)) { flushPara(para, tags); para = ""; inEq = true; }
    if (inTable || inEq) {
      // evidence inside tables lands in the auto-appendix (placement stays empty)
      for (const id of ids) if (!CLAIMS[id]) taggedUnknown.add(id);
      if (/\\end\{table\}/.test(code)) { inTable = false; cur.paras.push(`<p class="ph">[Table: see .tex — the table evidence is listed below under “Not in running text”]</p>`); }
      if (/\\end\{equation\}/.test(code)) inEq = false;
      continue;
    }
    const h = code.match(/\\(?:chapter|section|subsection)\*?\{([^}]*)\}/);
    if (h) { flushPara(para, tags); para = ""; cur.paras.push(`<h3>${esc(h[1])}</h3>`); continue; }
    if (isStructural) continue;
    const text = detex(code).trim();
    if (!text) {
      if (ids.length) tags.push({ ids, at: Math.max(0, para.replace(/\s+/g, " ").trim().length - 1) });
      if (!code.trim() && para) { flushPara(para, tags); para = ""; }
      continue;
    }
    para += (para ? " " : "") + text;
    if (ids.length) tags.push({ ids, at: para.replace(/\s+/g, " ").trim().length - 1 });
  }
  flushPara(para, tags);
  if (!cur.paras.filter(p => !p.startsWith("<h3")).length)
    cur.paras.push(`<p class="ph">(Skeleton — filled in only once real results exist)</p>`);
}

// auto-appendix: claims with no place in the running text
const unplaced = Object.keys(CLAIMS).filter(id => !placements.has(id));
if (unplaced.length) {
  sections.push({ title: "Evidence not placed in running text (tables/appendix)", paras: [
    unplaced.map(id => `<p><c data-cid="${id}">${esc(CLAIMS[id].needle)}</c> <a class="cite" data-src="${CLAIMS[id].key}">[${CLAIMS[id].key}]</a></p>`).join("")
  ]});
}

// hashes: sentence + needle + source -> invalidation
const hashes = {};
for (const [id, c] of Object.entries(CLAIMS))
  hashes[id] = sha((placements.get(id) || "") + "|" + c.needle + "|" + c.key);

writeFileSync(join(here, "content.gen.js"),
  "// GENERATED by build_content.mjs — do not edit by hand.\n" +
  `export const SECTIONS = ${JSON.stringify(sections, null, 1)};\n` +
  `export const HASHES = ${JSON.stringify(hashes, null, 1)};\n` +
  `export const CITECTX = ${JSON.stringify(citeContexts)};\n`);

console.log(`Sections: ${sections.length} | placed claims: ${placements.size}/${Object.keys(CLAIMS).length} | cites: ${cix} | auto-appendix: ${unplaced.length}`);
console.log("  Next step: node build_anchors.mjs  (verified jump targets for all cites)");
if (unplaced.length) console.log("  Appendix:", unplaced.join(", "));
if (taggedUnknown.size) console.log("  tagged without a claim entry (ok, ignored):", [...taggedUnknown].join(", "));
