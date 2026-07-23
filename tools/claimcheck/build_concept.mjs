// Renders concept/*.md -> concept.gen.js: light Markdown->HTML.
// Core: every supported CLAIM (the clause right before the source label)
// becomes a marked, clickable <span class="claim" data-src=KEY
// data-needle="supporting passage">. The label itself ("(Guo 2024)") becomes
// just a quiet <span class="cite"> tag (names inside it individually clickable).
// The jump target per claim is chosen from the source's already-verified
// passages (CLAIMS/LOGCLAIMS/ANCHORS) by word overlap with the claim,
// not "first passage of the source".
// Usage: node build_concept.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SOURCES } from "./claims.js";
import { CONCEPT_ANCHORS } from "./concept_anchors.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(process.env.HOME, "Documents/dev/bacherlors-thesis");

/* ---- refs.bib -> author/year per key ---- */
const bib = readFileSync(join(repo, "thesis/refs.bib"), "utf8");
function firstSur(au) {                                  // surname of the FIRST author
  const first = au.split(/\s+and\s+/i)[0].trim();
  const sur = first.includes(",") ? first.split(",")[0] : first.split(/\s+/).pop();
  return sur.toLowerCase().replace(/[^a-zä-ü]/g, "");
}
const entries = {};
for (const m of bib.matchAll(/@\w+\{([^,]+),([\s\S]*?)\n\}/g)) {
  const au = (m[2].match(/author\s*=\s*[{"]([\s\S]*?)[}"]/) || [])[1] || "";
  entries[m[1].trim()] = {
    sur: [...au.matchAll(/([A-ZÄÖÜ][a-zä-ü]+)/g)].map(x => x[1].toLowerCase()),
    yr: (m[2].match(/year\s*=\s*[{"]?(\d{4})/) || [])[1] || "",
    first: firstSur(au),
  };
}
const ALIAS = { "belch & belch": "belch2021advertising", "belch and belch": "belch2021advertising",
  "self-refine": "madaan2023selfrefine", "consistory": "tewel2024consistory", "rankme": "novikova2018rankme",
  "agenttaxo": "wang2025agenttaxo", "cut the crap": "zhang2025", "interleavedeval": "liu2024interleaved",
  "spaq": "fang2020spaq", "openai": "openai2026seed", "anthropic": "anthropic2024agents", "meta": "meta2026adsguide" };
const STOP = new Set(["The","This","We","Fine","Coarse","Both","API","VLM","OCR","IAB","DIY","Pairwise","Pointwise","Justice","Prejudice","SRCC","Reel","Story","Instagram","Independent","Monolithic","MAS","Only","Same","Each","Where","Input","Quality","Producers","Producer","Critic","Future","Open","Grounding","Validity","Roles","Task","Platforms","Structurally"]);

// author/year -> refs.bib key. Prefer the first author (otherwise a co-author like
// "Huang" in S2-MAD catches the cite "Huang 2024"), then exact year, else +/-1.
function resolve(name, year) {
  const n = name.toLowerCase().replace(/[.,]/g, "").trim();
  if (ALIAS[n]) return ALIAS[n];
  const sur = n.split(/[\s-]+/)[0].replace(/[^a-zä-ü]/g, "");
  let c = Object.entries(entries).filter(([, e]) => e.sur.includes(sur));
  if (year) { const y = c.filter(([, e]) => Math.abs(+e.yr - +year) <= 1); if (y.length) c = y; }
  const fa = c.filter(([, e]) => e.first === sur);         // prefer a first-author match
  if (fa.length) c = fa;
  if (year) { const ex = c.filter(([, e]) => +e.yr === +year); if (ex.length) c = ex; }
  return c.length ? c[0][0] : null;
}

/* ---- jump target per claim: linked BY HAND only, NO guessing ----
   linked   = passage is in concept_anchors.js (someone read it: it supports the statement)
   unlinked = PDF present but not linked yet -> click opens the source without a highlight
   external = web/book without a free PDF -> opens in the browser */
const STATUS_TITLE = {
  linked: "linked by hand: this passage supports the statement",
  quoted: "supporting text from the source – shown on the right",
  unlinked: "not linked yet – opens the source, find the passage yourself",
  external: "external source without available text – opens in the browser",
};
function pickPassage(key, claim) {
  const c = claim.replace(/[*`]/g, "");                    // ignore Markdown emphasis (*x* `x`) when matching
  const ov = CONCEPT_ANCHORS.find(a => a.src === key && c.includes(a.contains));
  if (!SOURCES[key] || !SOURCES[key].pdf) {                // external source (no PDF)
    if (ov && ov.quote) return { quote: ov.quote, status: "quoted" };  // show the quote directly on the right
    return { status: "external" };                         // otherwise just a link
  }
  if (ov && ov.needle) return { needle: ov.needle, status: "linked" };
  return { status: "unlinked" };
}

/* ---- inline: claim + label ---- */
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// light LaTeX -> readable (the concept docs only use \text \frac \sqrt \min \times)
function texLite(t) {
  return t.replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1) / ($2)")
    .replace(/\\times/g, " × ").replace(/\\cdot/g, " · ").replace(/\\min/g, "min")
    .replace(/\\,/g, " ").replace(/\\ /g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
function mdi(s) {                                           // inline Markdown (source links handled by linkClaims)
  return esc(s)
    .replace(/\$([^$]+)\$/g, (m, tex) => `<span class="math">${texLite(tex)}</span>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {  // [text](target): .md -> tab switch, otherwise external
      const md = /^(\d*-?[\w-]+)\.md$/.exec(url);
      return md ? `<a class="doclink" data-doc="${md[1]}">${txt}</a>`
                : `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
const NAMERE = () => /([A-ZÄÖÜ][A-Za-zä-ü.\-]+(?: (?:&|and) [A-Z][a-zä-ü]+)?)(\s*((?:19|20)\d\d))?/g;
// resolvable sources inside a parenthesis (with position)
function sourcesIn(inner) {
  const src = []; const re = NAMERE(); let m;
  while ((m = re.exec(inner))) {
    const nm = m[1], yr = m[3];
    if (STOP.has(nm) || nm.length < 3) continue;
    const key = resolve(nm, yr);
    if (key && SOURCES[key]) src.push({ key, name: m[0] });
  }
  return src;
}
// link each name in the label individually
function linkNames(inner, claim) {
  let out = "", last = 0, m; const re = NAMERE();
  while ((m = re.exec(inner))) {
    out += esc(inner.slice(last, m.index));
    const full = m[0], nm = m[1], yr = m[3];
    const key = (STOP.has(nm) || nm.length < 3) ? null : resolve(nm, yr);
    if (key && SOURCES[key]) {
      const { needle, quote, status } = pickPassage(key, claim);
      out += `<a class="cite-src" data-src="${key}" data-status="${status}"${needle ? ` data-needle="${escAttr(needle)}"` : ""}${quote ? ` data-quote="${escAttr(quote)}"` : ""} title="${escAttr(SOURCES[key].label)}">${esc(full)}</a>`;
    } else out += esc(full);
    last = m.index + full.length;
  }
  return out + esc(inner.slice(last));
}

let claimCount = 0; const usedSrc = new Set(); const statusCount = {};
function linkClaims(s) {
  // find candidate labels: parentheses with a resolvable source, plus a bare "Belch & Belch"
  const cites = [];
  for (const m of s.matchAll(/\(([^()]*)\)/g)) {
    const src = sourcesIn(m[1]);
    if (src.length) cites.push({ start: m.index, end: m.index + m[0].length, inner: m[1], src, paren: true });
  }
  for (const m of s.matchAll(/\bBelch (?:&|and) Belch\b/g)) {
    if (!cites.some(c => m.index >= c.start && m.index < c.end))
      cites.push({ start: m.index, end: m.index + m[0].length, inner: m[0], src: [{ key: "belch2021advertising", name: m[0] }], paren: false });
  }
  if (!cites.length) return mdi(s);
  cites.sort((a, b) => a.start - b.start);

  let out = "", cursor = 0;
  for (const c of cites) {
    if (c.start < cursor) continue;                        // ignore overlapping ones
    // claim = text since the last boundary (. ; : —) before the label
    const seg = s.slice(cursor, c.start);
    let last = 0, bm; const br = /([.;:—])\s+/g;
    while ((bm = br.exec(seg))) last = bm.index + bm[0].length;
    const claimStart = cursor + last;
    const rawClaim = s.slice(claimStart, c.start);
    // trim leading conjunctions/punctuation (otherwise fragments like ", for NLG criteria")
    const lead = rawClaim.match(/^[\s,;:—]*(?:(?:and|or|but)\s+)?/i)[0];
    const trail = rawClaim.slice(lead.length).match(/\s*$/)[0];
    const claimText = rawClaim.slice(lead.length, rawClaim.length - trail.length);
    out += mdi(s.slice(cursor, claimStart) + lead);        // text before the claim (incl. the trimmed lead)
    if (claimText.trim()) {
      const primary = c.src[0];
      const { needle, quote, status } = pickPassage(primary.key, claimText);
      claimCount++; statusCount[status] = (statusCount[status] || 0) + 1; c.src.forEach(x => usedSrc.add(x.key));
      out += `<span class="claim" data-src="${primary.key}" data-status="${status}" title="${STATUS_TITLE[status]}"${needle ? ` data-needle="${escAttr(needle)}"` : ""}${quote ? ` data-quote="${escAttr(quote)}"` : ""}>${mdi(claimText)}</span>`;
    }
    out += trail;
    // label
    if (c.paren) out += `<span class="cite">(${linkNames(c.inner, claimText)})</span>`;
    else {
      const { needle, quote, status } = pickPassage(c.src[0].key, claimText);
      out += `<span class="cite"><a class="cite-src" data-src="${c.src[0].key}" data-status="${status}"${needle ? ` data-needle="${escAttr(needle)}"` : ""}${quote ? ` data-quote="${escAttr(quote)}"` : ""} title="${escAttr(SOURCES[c.src[0].key].label)}">${esc(c.inner)}</a></span>`;
    }
    cursor = c.end;
  }
  return out + mdi(s.slice(cursor));
}
const inline = s => linkClaims(s);

/* ---- mini Markdown -> HTML ---- */
function mdToHtml(md) {
  const out = []; const lines = md.split("\n"); let i = 0;
  while (i < lines.length) {
    let l = lines[i];
    if (/^```/.test(l)) { const lang = l.slice(3).trim(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++;
      out.push(lang === "mermaid" ? `<div class="mermaid-note">▸ diagram (${buf.length} lines, in the .md)</div>`
        : `<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    if (/^#{1,6}\s/.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>${inline(l.replace(/^#+\s/, ""))}</h${n}>`); i++; continue; }
    if (/^\s*\|.*\|/.test(l) && /\|/.test(lines[i + 1] || "")) { const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.split("|").slice(1, -1).map(c => c.trim());
      const head = cells(rows[0]); const body = rows.slice(2).map(cells);
      out.push(`<table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${
        body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); continue; }
    if (/^\s*[-*]\s/.test(l)) { const items = []; const ind = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) { ind.push(lines[i].match(/^\s*/)[0].length); items.push(lines[i++].replace(/^\s*[-*]\s/, "")); }
      out.push(`<ul>${items.map(x => `<li>${inline(x)}</li>`).join("")}</ul>`); continue; }
    if (/^\s*>\s?/.test(l)) { out.push(`<blockquote>${inline(l.replace(/^\s*>\s?/, ""))}</blockquote>`); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [l]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\||\s*>)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

const cdir = join(repo, "concept");
const order = ["README.md", "01-topologies.md", "02-run-anatomy.md", "03-metrics.md", "04-analysis.md"];
const files = order.filter(f => readdirSync(cdir).includes(f));
const docs = files.map(f => ({ id: f.replace(".md", ""),
  title: f.replace(".md", "").replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
  html: mdToHtml(readFileSync(join(cdir, f), "utf8")) }));

writeFileSync(join(here, "concept.gen.js"),
  "// GENERATED by build_concept.mjs — concept/*.md as HTML with marked claims.\n" +
  `export const CONCEPT_DOCS = ${JSON.stringify(docs)};\n`);
console.log(`concept docs: ${docs.length} | marked claims: ${claimCount} | distinct sources: ${usedSrc.size}`);
console.log(`  Status: ${Object.entries(statusCount).map(([k, v]) => `${k} ${v}`).join(" | ")}`);
