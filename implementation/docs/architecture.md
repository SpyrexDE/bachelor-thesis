# Architecture

One Python package (`grain`), one FastAPI process, one SQLite database, artifacts as
files on disk. No queue, no ORM, no build step. The system has two halves: the
**harness** (execute runs, record traces, compute metrics) and the **evaluation
platform** (human review tasks, analysis, the two UIs).

## Design vocabulary

The agent-system design follows Dibia, *Designing Multi-Agent Systems* (O'Reilly;
companion code `picoagents`), which is also the pattern canon the concept cites
via Anthropic 2024. The mapping:

| Here | Book concept |
|---|---|
| `agents/roles.py` — a role = model client + instructions + output parser | Agent (model + instructions + interface) |
| `agents/messages.py` — typed messages between roles | Typed messages through workflows |
| `topologies/` — wiring only; roles are identical everywhere | Workflow patterns: single agent, parallelization (sectioning), orchestrator-workers, evaluator-optimizer |
| `topologies/stopping.py` — Fine's stopping rule | Termination conditions |
| `providers/` | Model clients (`llm/`) |
| `harness/trace.py` — per-call telemetry (tokens, seeds, timing, parents) | Observability / tracing |
| `metrics/` — VLM judges + code checks | Evaluation: LLM-as-judge + reference-based validation |
| `web/admin` | Web UI over the agent runtime |

Deliberately not adopted: an agent framework or runtime (middleware, memory,
LLM-driven orchestration). The study fixes the decomposition skeleton
(concept/01) and needs exact token accounting and seed-level reproducibility;
a framework would blur both (decisions.md D12). The topologies are workflow
patterns by design — the one autonomous element is Fine's critic loop, and its
termination rule is pinned in code and tests.

## Data flow

```
brief fixture ──> topology executor ──> trace + artifact files ──> metrics ──> analysis
                     (provider calls)         (store)                            │
review plan ──> rater sessions ──> votes + ratings ──> agreement stats ──────────┘
```

- A **run** is one `(brief, topology, rep)` execution with a recorded seed
  (concept/02). The executor walks the topology, logs every provider call
  (role, seed, tokens, timestamps) into the trace, and writes artifacts to disk.
- **Metrics** are computed right after a run finishes and stored as rows; nothing is
  recomputed on page load.
- The **review plan** materialises the A/B pairs and rubric assignments from
  concept/03 (between-topology pairs, within-topology controls, anchors, scrambles)
  into review sets and sessions. Raters work through a session via a code; they never
  see topology labels.
- **Analysis** aggregates stored metric rows and review results into the shapes of
  concept/04: per-topology distributions, per-step effect sizes, the Pareto view,
  the round curve.

## Boundaries and seams

Two seams exist because the deployment target (Henkel AI playground, Docker) will
swap them; nothing else is abstracted.

- **Provider** (`providers/`): every model call — text, image, VIEScore judge,
  coherence judge — goes through the `Provider` protocol. Today only `MockProvider`
  implements it. A real provider (Azure) is a new module registered in
  `providers/registry.py`; selected via `GRAIN_PROVIDER`.
- **Store** (`store/`): plain SQL behind small functions. Porting to the playground's
  database means porting this package only.

Everything else is direct calls. Topology executors are plain functions sharing the
prompt definitions in `topologies/prompts.py`; the fair-comparison rules from
concept/01 (same producer prompt everywhere, concept slot absent in Independent,
Monolithic = combined Independent variant) live there and are pinned by tests.

## Execution model

Runs are executed by a background thread inside the API process, one batch job at a
time, with per-run status rows the UI polls. Mock runs take milliseconds; real
providers later just make the same job slower. The queue lives in memory, so at
startup every run or job still marked queued/running belonged to a dead process
and is swept to `failed` (`harness/jobs.py`); a re-run with the same seed
reproduces the run byte-for-byte under the mock.

Latency (concept/03) is not measured as harness wall clock: it is the critical path
over the trace's call graph, so parallel producer calls count once. Call timestamps
are real; under the mock, each call also carries a simulated duration that stands in
for realistic API time (see decisions.md D4).

## Deployment

- **Local dev**: `poetry run uvicorn grain.api.app:app --reload`; data in `./data`.
- **Docker** (reference): `docker compose up --build`; image installs tesseract and
  fonts, data volume-mounted at `/data`.
- **Henkel playground** (later): same image contract — configuration only via
  `GRAIN_*` environment variables, `/health` endpoint, single exposed port, no
  external assets at runtime. Swapping mock for Azure and SQLite for the platform
  database touches `providers/` and `store/` only.

## Configuration

`grain/config.py` reads `GRAIN_*` env vars once at startup: `GRAIN_DATA_DIR`
(default `./data`), `GRAIN_BRIEFS_DIR`, `GRAIN_PROVIDER` (default `mock`), and
`GRAIN_ADMIN_TOKEN` (unset = open console; set it whenever raters get a link,
D13). Port and host belong to the uvicorn command line / Dockerfile. No config
files.
