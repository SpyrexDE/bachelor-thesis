// Resolves informal inline refs from concept/*.md ("(Tang 2025)", "Belch & Belch",
// "(ConsiStory)") to refs.bib keys / SOURCES. Tests the coverage.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SOURCES } from "./claims.js";

const bib = readFileSync(join(process.env.HOME, "Documents/dev/bacherlors-thesis/thesis/refs.bib"), "utf8");
// key -> {authorsLc, year}
const entries = {};
for (const m of bib.matchAll(/@\w+\{([^,]+),([\s\S]*?)\n\}/g)) {
  const key = m[1].trim(), body = m[2];
  const au = (body.match(/author\s*=\s*[{"]([\s\S]*?)[}"]/) || [])[1] || "";
  const yr = (body.match(/year\s*=\s*[{"]?(\d{4})/) || [])[1] || "";
  const sur = [...au.matchAll(/([A-ZÄÖÜ][a-zä-ü]+)/g)].map(x => x[1].toLowerCase());
  entries[key] = { sur, yr, title: (body.match(/title\s*=\s*[{"]([\s\S]*?)[}"]/) || [])[1] || "" };
}
// alias: title shorthands/special forms -> key
const ALIAS = {
  "belch & belch": "belch2021advertising", "belch and belch": "belch2021advertising",
  "self-refine": "madaan2023selfrefine", "consistory": "tewel2024consistory",
  "rankme": "novikova2018rankme", "agenttaxo": "wang2025agenttaxo",
  "cut the crap": "zhang2025", "do repetitions matter": "alvarado2025repetitions",
  "interleavedeval": "liu2024interleaved", "spaq": "fang2020spaq",
  "openai": "openai2026seed", "anthropic": "anthropic2024agents", "meta": "meta2026adsguide",
};
function resolve(name, year) {
  const n = name.toLowerCase().replace(/[.,]/g, "").trim();
  if (ALIAS[n]) return ALIAS[n];
  const sur = n.split(/[\s-]+/)[0].replace(/[^a-zä-ü]/g, "");
  let cands = Object.entries(entries).filter(([k, e]) => e.sur.includes(sur));
  if (year) { const y = cands.filter(([k, e]) => Math.abs(+e.yr - +year) <= 1); if (y.length) cands = y; }
  return cands.length ? cands[0][0] : null;
}

// scan concept/*.md
const cdir = join(process.env.HOME, "Documents/dev/bacherlors-thesis/concept");
const RE = /\(([^)]*\b(?:19|20)\d\d[^)]*)\)|\bBelch (?:&|and) Belch\b/g;
let total = 0, ok = 0; const unresolved = new Set(), hits = new Set();
for (const f of readdirSync(cdir).filter(f => f.endsWith(".md"))) {
  const txt = readFileSync(join(cdir, f), "utf8");
  for (const m of txt.matchAll(RE)) {
    const inside = m[1] || m[0];
    // multiple refs per parenthesis: split on ; and , with year
    for (const part of inside.split(/;/)) {
      const rm = part.match(/([A-Za-z][A-Za-z.\-& ]+?)\s*((?:19|20)\d\d)?(?:,|$|\))/);
      for (const nm of (part.match(/[A-Z][A-Za-z-]+(?: (?:&|and) [A-Z][a-z]+)?/g) || [])) {
        const yr = (part.match(/(19|20)\d\d/) || [])[0];
        if (["The","This","We","Fine","Coarse","Both","API","VLM","OCR","IAB","DIY"].includes(nm)) continue;
        total++;
        const key = resolve(nm, yr);
        if (key && SOURCES[key]) { ok++; hits.add(key); } else unresolved.add(nm + (yr ? " " + yr : ""));
      }
    }
  }
}
console.log(`Ref mentions: ${total} | resolved to SOURCES: ${ok} (${Math.round(100*ok/total)}%) | distinct sources: ${hits.size}`);
console.log("not resolved:", [...unresolved].slice(0, 25).join(" · "));
