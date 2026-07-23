# Implementation

Runs the experiment defined in [`../concept/`](../concept/): 3 briefs x 4 topologies x 3 reps,
five machine metrics, two human evaluation tasks, and the analysis that answers the RQ.
The concept is the specification; this code implements it and is checked against it
([`tests/test_concept_invariants.py`](tests/test_concept_invariants.py)).

Model calls go through a provider interface. The only provider today is a deterministic
mock, so everything runs end-to-end without API keys. Mock output demonstrates the
pipeline mechanics, not findings.

## Run it

Everything runs in the container. The image carries tesseract (OCR for spec
compliance), so the whole test suite runs in one place with nothing silently
skipped — and there is no second local environment to keep in sync.

Reference setup (code baked into the image, as when deployed):

```sh
docker compose up --build        # http://localhost:8000
```

Dev mode (source mounted live, uvicorn auto-reloads on edits):

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Tests (full suite, tesseract present):

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm grain pytest
```

- `/` — researcher UI: start and manage runs, inspect artifacts, metrics, review results, analysis.
- `/review` — rater UI: A/B votes and rubric ratings, entered via a session code.

Data (SQLite + artifact files) lives in `./data`, configurable via `GRAIN_DATA_DIR`.

## Documentation

| Doc | Answers |
|---|---|
| [docs/design.md](docs/design.md) | Why it is built this way — scope, non-goals, owned trade-offs. |
| [docs/architecture.md](docs/architecture.md) | How it works — pipeline, execution model, seams, HTTP surface, configuration. |
| [docs/how-to.md](docs/how-to.md) | Common tasks — run, test, review rounds, reset, add a provider. |

`docs/.ai/` holds working documentation for the coding agents that build this
(conventions, decision log, UI method); it is not part of the documentation
above.

## Layout

| Path | Content |
|---|---|
| `src/grain/domain/` | Briefs, platform specs, topology names, run/artifact records. No IO. |
| `src/grain/providers/` | Model-call interface + the mock provider. |
| `src/grain/topologies/` | The four executors and the shared role prompts. |
| `src/grain/harness/` | Run executor, seeding, tracing, background jobs. |
| `src/grain/metrics/` | Coordination tax, VIEScore, set coherence, spec compliance, latency. |
| `src/grain/review/` | A/B pair plan, rubric assignments, sessions, agreement statistics. |
| `src/grain/analysis/` | Effect sizes, Pareto frontier, round curve. |
| `src/grain/store/` | SQLite schema and access, artifact files on disk. |
| `src/grain/api/` | FastAPI app and routers, serves the two UIs. |
| `src/grain/web/` | Static frontend (vanilla HTML/CSS/JS): `admin/`, `review/`. |
| `briefs/` | The three brief fixtures (illustrative, not official Henkel copy). |
| `tests/` | Pytest suite, including the concept-invariant tests. |
| `docs/` | [design](docs/design.md), [architecture](docs/architecture.md), [how-to](docs/how-to.md); agent working docs under `docs/.ai/`. |
