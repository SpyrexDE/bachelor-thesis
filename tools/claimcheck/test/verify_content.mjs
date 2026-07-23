// Gate 2: is content.gen.js consistent? Every link -> a real claim,
// every claim reachable, every claim hashed.
import { CLAIMS, LOGCLAIMS } from "../claims.js";
import { SECTIONS, HASHES } from "../content.gen.js";

let fail = 0;
const ok = (n, c, x) => { console.log((c ? "PASS  " : "FAIL  ") + n + (c ? "" : "  <<< " + (x ?? ""))); if (!c) fail++; };

const html = SECTIONS.map(s => s.paras.join("")).join("");
const used = [...html.matchAll(/data-cid="([a-z0-9-]+)"/g)].map(m => m[1]);
const unknown = used.filter(id => !CLAIMS[id] && !LOGCLAIMS[id]);
ok("all data-cid point to real claims/log evidence", unknown.length === 0, unknown.join(","));
const missing = Object.keys(CLAIMS).filter(id => !used.includes(id));
ok("all 26 claims reachable in the document", missing.length === 0, missing.join(","));
ok("all claims hashed", Object.keys(CLAIMS).every(id => /^[0-9a-f]{12}$/.test(HASHES[id] || "")));
ok("sections present (9 chapters + appendix)", SECTIONS.length === 10, SECTIONS.length);
ok("no LaTeX junk in the HTML (\\cite, \\textbf, {})", !/\\cite|\\textbf|\\emph|\\section/.test(html));

// slop gates: visible text only (tags removed), then check for glued/leftover patterns
const txt = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const glued = txt.match(/[a-zß]\.[A-ZÄÖÜ][a-z]/g) || [];         // "purpose.Multi"
ok("no glued sentence boundaries", glued.length === 0, glued.slice(0, 6).join(" | "));
const cmds = txt.match(/\\[a-zA-Z]+/g) || [];                     // leftover \commands
ok("no leftover LaTeX commands in the text", cmds.length === 0, cmds.slice(0, 6).join(" "));
ok("no stray curly braces", !/[{}]/.test(txt));
const emptyParen = txt.match(/\([\s,→/]*\)/g) || [];              // "(/, /)", "(→)"
ok("no hollowed-out parentheses", emptyParen.length === 0, emptyParen.slice(0, 6).join(" "));

console.log(fail ? `\n${fail} FAIL` : "\nCONTENT GREEN");
process.exit(fail ? 1 : 0);
