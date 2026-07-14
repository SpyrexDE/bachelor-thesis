# Decisions

Short, dated, append-only. Format: what was decided, why, what it forecloses.

## D1 — 2026-07-12 — Package name `grain`, src layout
Named after the manipulated variable (task granularity). `src/grain/` with poetry.

## D2 — 2026-07-12 — SQLite via stdlib + artifacts as files
`sqlite3` with hand-written SQL in `store/`; images and captions as files under
`data/runs/<run_id>/`. No ORM: the schema is small, SQL stays visible and
defensible. The Henkel playground database later replaces `store/` internals only.

## D3 — 2026-07-12 — Provider seam, mock only
One `Provider` protocol for text, image, and judge calls. Only `MockProvider`
exists; no Azure stub is committed (dead code). Adding Azure = new module + one
registry entry + env var.

## D4 — 2026-07-12 — Latency = critical path over the trace
Concept/03 wants brief-to-set wall clock with parallel producers actually parallel.
Harness wall clock would make mock runs meaningless and real runs
scheduling-dependent, so latency is computed from the trace: longest path over the
call graph using per-call durations. Real providers report measured durations; the
mock reports simulated ones (deterministic, plausible magnitudes). Recorded
alongside: raw harness wall clock, for the pilot sanity check.

## D5 — 2026-07-12 — Mock is information-flow-faithful
The mock never hardcodes topology outcomes. Producers derive angle/palette/wording
only from their actual inputs (brief, concept if present, critic feedback if
present); divergence in Independent, alignment in Coarse/Fine, and the Fine round
curve *emerge* from what each call can see — same mechanism the real system will
have. Mock judges score measurable set features (message-token overlap, palette
distance, tone markers) plus seeded noise. The in-loop proxy is a different, simpler
function than the official coherence judge (concept/01 validity caution holds in
mock mode too).

## D6 — 2026-07-12 — OCR via tesseract
Spec compliance reads rendered text via OCR (concept/03). Tesseract in the Docker
image; local tests skip OCR cases if the binary is missing.

## D7 — 2026-07-12 — Background thread + job rows, no queue
One worker thread in the API process executes batch jobs; progress lives in job/run
rows the UI polls. Celery/Redis would be dead weight at n=36.

## D8 — 2026-07-12 — Brief fixtures are illustrative
Persil/Schwarzkopf/Loctite briefs (concept/02) are written for this study:
plausible, complete (all ten elements), but not official Henkel copy. Mandatories
(required claims, prohibited wording) are chosen so spec checks have real work.

## D9 — 2026-07-12 — Statistics by hand, no scipy
Means, spreads, Spearman, Cohen's kappa, win-rate CIs (Wilson) implemented directly
and tested against hand-worked examples. Keeps the image slim and every number
explainable line by line.

## D10 — 2026-07-12 — Charts as inline SVG
Box plots, Pareto scatter, round curve rendered by small JS functions into SVG. No
chart library: the playground forbids CDNs, and the plots are simple.

## D11 — 2026-07-12 — In-loop proxy (concept/01 open point), mock stand-in
Until the real proxy is chosen in the pilot, the mock proxy is keyword/palette
overlap across the draft set — cheap, deliberately cruder than the official judge,
and clearly separated in code (`topologies/proxy.py` vs `metrics/set_coherence.py`).
The real choice remains open and belongs to the pilot phase.

## D13 — 2026-07-12 — Opt-in admin token protects blinding
Raters and the researcher share one server; without a gate a rater could open
the researcher API and unblind (audit finding). With `GRAIN_ADMIN_TOKEN` set,
everything under `/api` except the rater session endpoints requires the token
(header `X-Admin-Token`; the console prompts once and stores it). Unset means
open — fine for local work, set it whenever raters get a link.

## D12 — 2026-07-12 — Agent/message/termination structure per Dibia, no framework
Roles (`agents/roles.py`), typed messages (`agents/messages.py`), and the
termination rule (`topologies/stopping.py`) follow the decomposition in Dibia,
*Designing Multi-Agent Systems*: agents are defined once, topologies are pure
wiring. No agent framework (AutoGen/picoagents/LangGraph) is used: the study
fixes the decomposition skeleton, counts every token by hand (coordination tax),
and needs byte-level reproducibility from recorded seeds — a framework runtime
would own exactly those things. Verified by the smoke run: the refactor changed
no metric value.
