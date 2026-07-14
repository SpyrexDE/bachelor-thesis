# Implementation

Runs the experiment defined in [`../concept/`](../concept/): 3 briefs x 4 topologies x 3 reps,
five machine metrics, two human evaluation tasks, and the analysis that answers the RQ.
The concept files are normative. Code follows them; where they conflict, the concept wins.
Nothing in here may edit `concept/`.

Model calls go through a provider interface. The only provider today is a deterministic
mock, so everything runs end-to-end without API keys. Mock output demonstrates the
pipeline mechanics, not findings.

## Run it

Docker (the reference setup — code baked into the image, as on the playground):

```sh
docker compose up --build        # http://localhost:8000
```

Docker dev mode (source mounted live, auto-reload; no local Python needed):

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Local development:

```sh
poetry install
poetry run uvicorn --factory grain.api.app:create_app --reload   # http://localhost:8000
poetry run pytest
```

- `/` — researcher UI: start and manage runs, inspect artifacts, metrics, review results, analysis.
- `/review` — rater UI: A/B votes and rubric ratings, entered via a session code.

Data (SQLite + artifact files) lives in `./data`, configurable via `GRAIN_DATA_DIR`.

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
| `docs/` | [architecture](docs/architecture.md), [conventions](docs/conventions.md), [decisions](docs/decisions.md), [design-rationale](docs/design-rationale.md), [ui-method](docs/ui-method.md). |
