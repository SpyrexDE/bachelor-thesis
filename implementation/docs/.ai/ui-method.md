# UI design method

The lens applied before touching any screen. Skipping it yields reactive
patches and default components — the failure mode this file exists to prevent.

## 1. Start from the decision, not the screen

Ask first: *what is the user trying to decide or find here?* Design backwards
from that one question. A screen is a tool for a decision, not a place to put
data. Each surface names its decision before anything is laid out:

- Matrix → "which topology wins, and where does it break down?"
- Runs list → "which runs are outliers, and open one."
- Run detail → "is this set any good, and *why* — do the numbers hold up?"
- Analysis → "what's the effect of granularity, with what spread?"

## 2. Prominence = importance to that decision

The most important thing for the decision is the biggest and first in reading
order. Everything else steps down. **Nothing is sized to "fill space"** — size
to importance for *this* decision, let leftover be margin. Importance is
decision-relative, not fixed per element: on the scanning views (matrix, runs
list) the *results* lead, because the task is comparing many runs; on the
single-run cockpit the *artifact set* takes the stage, because you came to
inspect one set — and its verdict sits co-equal in the rail beside it, never a
scroll away. What never happens either way is inflating mock content to fill a
card: the artifacts earn the stage because inspecting them *is* the task there,
not because a panel looked empty.

## 3. Match the component to the question — brainstorm ≥3, don't default

Every non-trivial number gets this pass. Pick the form that conveys *this* info
fastest and most honestly, not the one that's least work:

| The question | Good forms | Weak default to avoid |
|---|---|---|
| compare magnitudes | bars | — |
| **spot outliers / see spread** | dot plot on a shared scale, strip plot, **colour heat** | a lone progress bar (similar values look identical) |
| good vs bad / rank | direction-aware colour (red↔green) | a bar whose length ≠ goodness |
| trend over ordered steps | line with the value at each point | — |
| part-to-whole | one stacked bar | pie |
| single verdict | big number + quality colour | — |
| relationship of two vars | scatter | two bars |

Colour is the strongest pre-attentive channel — spend it on **value/goodness**
(so outliers pop), not merely on *which metric* it is. A progress bar encodes
magnitude, but a column of similar magnitudes reads as one grey smear; if the
task is "spot the outlier", colour-by-goodness beats it every time.

## 3b. Don't narrate what the visual already shows

A chart that needs a sentence explaining "parallel bars ran at once, chained
bars waited" is a chart that hasn't earned its place — fix the visual or trust
it. Explanatory prose that restates what the marks already encode is clutter and
a design smell. Legends are compact swatches, not sentences. The only text that
survives is what the visual genuinely *cannot* carry — a unit, a concept
citation — and even that belongs in a title/tooltip, not a banner above the
chart.

## 4. Link everything you can act on

If the user can find something in view A (a call in the timeline), they must be
able to jump from it to its detail (that call's payload) — clicking, not manual
hunting. Unlinked "look here, now go find it again below" is a defect.

## 5. Space is a budget spent on importance

Empty space is legitimate only as *deliberate, structural* margin. It is a
defect when it's a stretched card-belly, when filler pads pixels, or when demo
content crowds out results. Height follows content.

## 6. Verify by looking, then attack it

After every change: screenshot it, both themes, **at more than one width — the
narrow laptop *and* a 1920/ultrawide fullscreen** — on the *worst-case real run*
(the sparse one, the failing one), not the happy path. A layout that balances at
1440 can sprawl at 1920: bars stretch to a lone value a thousand pixels away,
text lines run past readable length. Cap the reading width and cap any element
that would otherwise eat `1fr` (a 0–5 score is a fixed gauge, not a line to the
edge). Then read it as a hostile reviewer who has never seen it:

- What can **not** be told at a glance?
- What must be **hunted** for?
- What **looks the same** but means different things (colour collisions)?
- Which element can't answer **"why this and not the alternative?"**

## 7. Stop only when it's defensible

Every element must survive "why this and not that?" with an answer rooted in the
task, the data, a consistency rule, or a named trade-off. Until then it isn't
done — keep iterating. Record the locked reasons in `design-rationale.md`.
