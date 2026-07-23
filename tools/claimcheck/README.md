# claimcheck

QA tool for evidence-checking. On the left, your real documents (the paper PDF and
the `concept/*.md`); on the right, the source. Click a **supported claim** →
the source PDF opens, jumps to the supporting passage and highlights it in yellow.

What is clickable is the **statement** itself (the clause a source supports),
not the label. The label "(Guo 2024)" is just a quiet tag; with multiple
sources the claim opens the first source, and a click on the name tag opens the
respective other one.

## Jump targets are linked by hand (no guessing)

Every evidence passage is entered by hand in `concept_anchors.js` — someone read the
statement + source and decided that the passage supports the statement. There is
**no** heuristic that guesses passages. The status per claim (style + tooltip):

| Style | Status | Meaning |
|---|---|---|
| solid underlay | **linked** | linked by hand: jumps to the supporting passage, highlights it |
| dashed | **unlinked** | PDF present but not linked yet — click opens the source without a highlight |
| dotted + ↗ | **external** | web/book without a free PDF, opens in the browser |

Linking a claim = add a line to `concept_anchors.js` (`{src, contains, needle}`) and
rebuild. The gate checks that the passage appears verbatim in the PDF (typos).

## Start

```
python3 serve.py          # http://localhost:8771/
```

Switcher at the top (paper PDF + the 5 concept docs), theme toggle top right
(system default, light/dark), zoom `+`/`−`/`0` or Cmd+scroll.

## Pipeline

1. `node build_content.mjs` — .tex drafts → `content.gen.js` (paper cites + contexts).
2. `node build_concept.mjs` — `concept/*.md` → `concept.gen.js`: marks every
   supported claim, takes its jump target (if any) from `concept_anchors.js`
   and assigns the status (linked / unlinked / external).
3. Link a new claim: enter the passage verbatim from the PDF into `concept_anchors.js`
   (`{src, contains, needle}`) and rebuild. `contains` = a unique
   piece of the claim text, `needle` = the supporting passage.

## Verification (offline, before every release)

```
npm test
```

- `verify_content.mjs` — paper linking + slop gates (glued sentences, LaTeX leftovers).
- `verify_needles.mjs` — every claim/log jump target verbatim in its PDF.
- `verify_anchors.mjs` — every paper-cite jump target verbatim in its source.
- `verify_concept_anchors.mjs` — every **verified** override passage verbatim in the
  PDF and matching a real claim (guards against mistyped/invented passages).

## Files

| File | Role |
|---|---|
| `claims.js` | `SOURCES` (source → PDF/URL + label) + draft claims/log evidence |
| `build_concept.mjs` | `concept/*.md` → marked claims + status |
| `concept_anchors.js` | **hand-checked** evidence passages (verified overrides) |
| `build_content.mjs` | .tex → `content.gen.js` (paper cites + contexts) |
| `index.html` | two-panel viewer (pdf.js in `vendor/`), theme, status styles |
| `test/*.mjs` | four offline gates |
| `serve.py` | local server, port 8771 (launch config "claimcheck") |

`*.gen.js` are generated; `pdfs/`, `node_modules/`, `anchor_tasks/`, `paper.pdf`
are gitignored.
