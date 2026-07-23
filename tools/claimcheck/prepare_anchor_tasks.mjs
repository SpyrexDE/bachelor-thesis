// Prepares one task per cite for the LLM: draft sentence + candidate
// passages from the source PDF (retrieval by word overlap + abstract). The LLM
// then picks/quotes the passage that supports the STATEMENT (next step).
// Usage: node prepare_anchor_tasks.mjs  -> anchor_tasks.json
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { SOURCES } from "./claims.js";
import { CITECTX } from "./content.gen.js";

const here = dirname(fileURLToPath(import.meta.url));
const STOP = new Set("the a an of to and or in on for with that this these those is are was were be been being by as at from into over under between within their its it they we our you your can could would should may might will not no only also more most than then so such each per one two three whole set same both other has have had do does".split(" "));
const content = s => (s.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter(w => !STOP.has(w));

const cache = new Map();
async function loadPdf(pdf) {
  if (cache.has(pdf)) return cache.get(pdf);
  let raw = "";
  const doc = await getDocument({ data: new Uint8Array(readFileSync(join(here, pdf))) }).promise;
  const pageText = [null];
  for (let p = 1; p <= doc.numPages; p++) {
    const t = (await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join(" ");
    pageText.push(t); raw += " " + t;
  }
  raw = raw.replace(/-\s+/g, "").replace(/\s+/g, " ").trim();
  // sentence units with page assignment (rough: cumulative length)
  const sents = [];
  let cum = 0; const offsets = [0];
  for (let p = 1; p < pageText.length; p++) { cum += pageText[p].length + 1; offsets[p] = cum; }
  for (const m of raw.matchAll(/[^.!?]{25,}[.!?]/g)) {
    const s = m[0].trim();
    if (content(s).length >= 4) sents.push(s);
  }
  const val = { raw, head: raw.slice(0, 2600), tail: raw.slice(-1500), sents, pages: doc.numPages };
  cache.set(pdf, val);
  return val;
}

// dedupe (key, sentence) -> collect cix
const tasksMap = new Map();
for (let i = 0; i < CITECTX.length; i++) {
  const { key, sentence } = CITECTX[i];
  if (!SOURCES[key]?.pdf) continue;
  const k = key + "||" + sentence;
  if (!tasksMap.has(k)) tasksMap.set(k, { key, sentence, cix: [] });
  tasksMap.get(k).cix.push(i);
}

const tasks = [];
for (const t of tasksMap.values()) {
  const { head, tail, sents } = await loadPdf(SOURCES[t.key].pdf);
  const q = new Set(content(t.sentence));
  const scored = sents.map(s => {
    const set = new Set(content(s)); let sh = 0; for (const w of set) if (q.has(w)) sh++;
    return { s, sh };
  }).filter(x => x.sh >= 2).sort((a, b) => b.sh - a.sh).slice(0, 8).map(x => x.s);
  // context = head (abstract+intro) + top overlap passages + tail, ~6000 chars
  const seen = new Set(); const ctx = [];
  for (const c of [head, ...scored, tail]) {
    const kk = c.slice(0, 40); if (seen.has(kk)) continue; seen.add(kk);
    ctx.push(c); if (ctx.join(" ").length > 6000) break;
  }
  tasks.push({ key: t.key, cix: t.cix, sentence: t.sentence,
    label: SOURCES[t.key].label, contexts: ctx });
}

writeFileSync(join(here, "anchor_tasks.json"), JSON.stringify(tasks, null, 1));
// one small file per task, read individually by an agent
const dir = join(here, "anchor_tasks");
try { rmSync(dir, { recursive: true, force: true }); } catch {}
mkdirSync(dir, { recursive: true });
tasks.forEach((t, i) => writeFileSync(join(dir, `task_${String(i).padStart(3, "0")}.json`),
  JSON.stringify({ i, label: t.label, statement: t.sentence, source_excerpts: t.contexts.join("\n\n") }, null, 1)));
console.log(`Tasks: ${tasks.length} (deduplicated from ${[...tasksMap.values()].reduce((n, t) => n + t.cix.length, 0)} cite occurrences with PDF)`);
console.log(`per-task files: ${dir}/task_000.json … task_${String(tasks.length - 1).padStart(3, "0")}.json`);
