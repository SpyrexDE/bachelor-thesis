# Design rationale

Every visible property of the admin UI answers to one of four things: the
**user's task**, the **data's meaning**, a **consistency rule**, or a **named
trade-off**. If a value is only "it looked ok", it is a bug, not a decision.
This file exists so any element can be interrogated and get a straight answer.

Two users, two tasks: the **researcher** (matrix, runs, review, analysis) reasons
about the experiment; the **rater** (`/review`) judges blind. The rater UI leaks
nothing about topology, run identity, or set kind — that constraint outranks
every aesthetic choice on that surface.

---

## 1. Foundations

### Colour — four families that never collide

The whole point is that a colour means exactly one thing. There are four
families and they occupy disjoint regions of hue so they can never be confused:

- **Accent (blue, `--accent`)** — *interactive, or "this run".* Links, the
  active nav item, the delivered-round dot, the "you are here" marker in a
  distribution strip. Blue never encodes a value.
- **Quality ramp (`q0`→`q5`, red→amber→green)** — *how good.* The only
  red-to-green axis in the app, so a warm-to-cool shift always means quality and
  nothing else. Used for set coherence (0–5) and VIEScore (0–10, mapped `/2`).
- **Status (`ok`/`warn`/`bad`)** — *state of a run or a check.* Green done,
  amber running/caution, red failed. Tinted backgrounds, never the ramp.
- **Topology tints (grey/teal/violet/rose)** — *the independent variable's
  identity.* Deliberately chosen **outside** every family above (outside the
  red-green ramp, outside status, outside cost-amber, outside accent-blue) so a
  topology mark is never misread as a good/bad/cost signal. Monolithic is
  neutral grey because it is the no-coordination baseline; the three multi-agent
  topologies earn colour. *(This is why `fine` is rose, not amber: amber is the
  cost colour, and in dark mode the old `fine` tint was byte-identical to
  `--warn`. Fixed.)*
- **Cost (`--warn` amber)** — coordination tax and latency are *prices*; warm =
  caution, and amber sits apart from quality-green and this-run-blue.

Rule that ties it together: **red-green = quality, blue = interaction, amber =
cost, categorical hues = topology, tinted status = state.** No colour does two
jobs.

### Type, space, shape

- One system font stack; `--mono` only for machine identifiers (run id, seed,
  token counts) — monospace signals "copyable literal".
- Micro-label convention: **≤10.5px uppercase letter-spaced** = an eyebrow /
  axis key (`.rf .k`, `.ministat .mk`); **≥11px sentence case** = a named field
  (`.stat .sl`, `.rd-tile .k`). Size tells you which kind of label it is.
- Radius rhythm: cards `8`, controls `6`, value tags `5`, status pills fully
  round. Rounded-rect = a value you read; pill = a state you glance.
- `12px` is the base gap between siblings; card padding `16`. Not derived, but
  applied uniformly so spacing reads as rhythm, not noise.

### Cross-cutting rules

1. **No naked number.** Every metric carries an encoding — heat tag, magnitude
   bar, or position-in-field strip. A lone figure the reader must contextualise
   by hand is the "log dump" failure this UI exists to avoid.
2. **Topology carries identity** (glyph + tint) everywhere it is named — list,
   matrix, scoreboard, crumb, boxplot, pareto, A/B steps.
3. **Two reading modes.** Scanning views (matrix, runs list) are *number-led* —
   they exist to compare many runs. The single-run detail page is *artifact-led*
   — you came to inspect one set, so the artifacts dominate and the numbers sit
   beside them (see §7).
4. **Charts show the value at the mark**, plus a hover tooltip for detail. Nobody
   counts gridlines. *(This is why the round curve now labels each point.)*
5. **Height follows content.** A card never stretches into an empty bordered
   belly; leftover screen is page margin outside the cards, never filler rows.

---

## 2. Matrix

Decision: *which topology wins, and where does it break down?*

- **Cell colour *is* the coherence** (heat ramp), so the pattern — which
  brief×topology cells are weak — reads before any number. The digit inside is
  the exact value for when you need it.
- **Grid on top, per-topology leaderboard below.** The grid never scrolls
  sideways; the summary sits *under* it (reading order: cells, then the
  per-topology verdict) as four full-width cards, not a table cramped to the
  right that overflowed. Each card: coherence median as the heat headline, the
  cost/quality medians beneath, the per-metric winner accented, and the top
  coherence card ringed in accent — the winner at a glance.
- **Topology header = identity chip**, tying each column to the same glyph/tint
  used everywhere else.

## 3. Runs list

Decision: *which runs are outliers, and open one.*

- **Column order = identity → status → quality → cost → time** (Set, Run,
  Status, Coherence, VIE, tax, latency, Spec, Created).
- **Every metric value is tinted by its goodness, direction-aware**, because
  colour is the pre-attentive channel and the task is *spot the outlier* — a red
  latency or a red tax jumps out of the column where equal-length bars all
  looked the same. Quality metrics use their absolute scale (green = genuinely
  good); cost metrics (tax, latency) normalise within the column (green =
  cheapest in the field), since there is no absolute "good latency". Coherence
  keeps its heat *tag* as the headline; the rest are heat *numbers*. Bars were
  dropped: length hid outliers.
- **A set thumbnail strip per row** (30px — identify-not-inspect size) anchors
  every number row to the artifacts it describes. Eager-loaded so it never
  flashes empty.

## 4. Run detail — a cockpit, depth by drilling

Decision: *is this set any good, and why — do the numbers hold up?* The failure
this page exists to avoid is the "log dump": a scrolling stack of sections where
a number sits far from the artifact it judges. So it is **one viewport with
drill-down, not scroll** — three regions that stay on screen, and depth comes
from clicking, not from scrolling past. Every number stays *attached to the
artifact it judges*.

- **Three regions, height follows content.** A left column holds the artifact
  **stage** (top) and a collapsed **drawer** (bottom); the **verdict rail** sits
  to the right at the same top edge (`.rd` grid `1fr / 356px`, `align-items:
  start` so neither column stretches into an empty belly). No forced `100vh`;
  capped at `1680px` so an ultrawide's surplus becomes symmetric page margin,
  not a well beside the set. Below `1080px` the grid falls back to a single
  stacked column.
- **Stage — the artifacts are the subject, always on screen.** One column per
  platform, each frame sized by its own aspect ratio (no letterbox wells),
  filling the stage width. Per-artifact VIE + spec chips sit on the tile; a
  round scrubber flags drafts and dots the delivered round; the brief cue
  (must-include / prohibited) hangs in the header as the yardstick, one hover
  away. A zoom button opens the lightbox. *(The mock artifacts are illustration,
  but on this page the reader came to inspect one set — so the set gets the
  stage and the numbers read beside it; see §3 "artifact-led" reading mode.)*
- **Rail — the verdict, and a drill card for one artifact.** The set-verdict
  card is a coherence hero on the heat ramp with matrix context (median + share
  of runs below this one), the three pillars with the judge's *why-text* on
  click (limiting pillar tagged only when pillars differ), and four metric tiles
  each carrying a `distStrip`: every finished matrix run as a tick, this run as
  the accent marker — a number reads as a position in the field, not a lone
  value. Clicking an artifact **pops a distinct detail card above** the set card,
  wearing the same accent outline as its stage tile: VIEScore with the
  min-formula spelled out, sub-score bars with the judge's rationales, spec
  checks (failures first, passes collapsed). Two cards, never one
  shared panel — the two scopes read as two things.
- **Drawer — telemetry one click down, never a scroll.** A collapsed bar (always
  visible) carries the token-share split (production / coordination / image) and
  the call / round / latency / tax summary; it opens to **Execution** (Gantt +
  expandable prompt/output rows) or **Rounds** (curve + delivered vs best)
  without leaving the page.
- **Execution timeline is linked to the trace:** click a Gantt bar and the
  matching call's row opens, scrolls into view and flashes — the timeline and
  the payloads are one thing, not two lists to cross-reference by hand.
- **Round curve labels each point** and offers a hover tooltip (round, coherence,
  the exact in-loop proxy). Three numbers must never require counting gridlines.
- **Draft rounds** show a "draft — delivered is round N" badge; the per-artifact
  verdict stays gated to the delivered round — the verdict belongs to what
  shipped, not to the draft you are previewing.

## 5. Review

- **Plan summary and results are stat tiles, not kv prose** — label over value,
  the value encoded where it can be (catch-validity as an ok/warn badge).
- **A/B results = win-rate rows** with both topologies' identity chips, a bar
  from the 0.5 tie line (green = the later topology won, red = it lost), a CI
  whisker, and the rate large on the right. The old SVG had plain-text labels and
  no identity.
- **Spearman ρ as a centred diverging bar** (−1…1), because a correlation's sign
  and strength should be seen, not parsed from a decimal.

## 6. Analysis

- **Boxplot and pareto tinted by topology** — the four series read apart by the
  same identity used everywhere; pareto frontier points fill solid, dominated
  ones stay hollow with a tinted ring, so identity and frontier-membership both
  show.
- **"Change from one topology to the next" = diverging bars**, the app's
  strongest use of width: sign sets the side, colour sets better/worse
  (direction-aware), per-brief ticks show the spread a lone SD hides. This
  replaced `loctite −1.00 · persil −1.67 …` — the worst number-wall in the app.

## 7. Owned trade-offs (not free wins)

- **Cost-metric heat is relative to the column.** In the runs list, tax/latency
  green means "cheapest *in the visible field*", not cheap in absolute terms —
  there is no absolute good latency. In a field of uniformly slow runs the least
  slow still reads green. Accepted, because the task is ranking/outliers within
  the set on screen; quality metrics keep an absolute scale where one exists.
- **VIE is encoded two ways:** a *bar* in the machine-metrics tile (position in
  the field) and quality *heat* on the artifact badge and hero (standalone
  judgment). Same metric, different question — comparison vs. verdict.
- **Cockpit hides telemetry behind a click.** Depth-by-drilling means the
  execution trace and round history live in the collapsed drawer, one click
  down, not on screen with the verdict. Accepted: the run-detail decision is
  "is the set good and why", which the stage + rail answer at a glance; the
  trace is the follow-up question, so it earns a click, not a permanent column.
  Chosen over a scrolling stack, where the numbers drift away from the artifacts
  they judge (the "log dump" this page was rebuilt to kill). On a short viewport
  the cockpit can still grow past `100vh` (height follows content); below
  `1080px` it drops to a single stacked column by design.

## 8. Corrections logged (so they don't regress)

- Run detail was a scrolling stack of sections (numbers far from the artifacts
  they judge, the same three artifacts shown twice) → rebuilt as the one-viewport
  cockpit: stage + verdict rail + drawer, depth by drilling instead of scroll.
- Runs-list metrics were uniform progress bars (length hid outliers) →
  direction-aware value heat.
- Matrix scoreboard sat right of the grid and forced a horizontal scroll →
  moved below as a full-width leaderboard.
- Execution timeline and trace table were unlinked (manual hunting) → click a
  Gantt bar to open its payload row.
- `fine` topology tint was cost-amber (dark-mode: identical to `--warn`) → rose.
- Per-artifact VIE badge was flat grey → quality heat.
- Round curve had no point values and no hover → labelled + tooltip.
- Charts carried explanatory prose restating the marks → stripped to compact
  swatch legends and title/tooltip notes.
- Metric distribution strip was 35 raw ticks (read as static) → a box-plot
  glance: shaded interquartile band, median tick, this-run dot.
- The artifact strip left ~half its card empty → the brief (must include / must
  avoid) now sits beside the thumbnails as the yardstick you judge them against.

Method for all of this: `ui-method.md`. Anything not covered here is not yet
deliberate — it needs a reason or a fix.
