# How-to

Task-oriented guides. Everything runs in the container; there is no host
Python environment to set up. Commands are run from `implementation/`.

## Run the app

```sh
docker compose up --build
```

Researcher console at `http://localhost:8000`, rater view at
`http://localhost:8000/review/?code=…`. Data persists in `./data` on the host.

## Develop with live reload

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Source, briefs, and tests are mounted into the container; uvicorn restarts on
Python edits, and UI files are served with `Cache-Control: no-store`, so a
browser reload is always current.

## Run the tests

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm grain pytest
```

The dev image carries pytest and tesseract, so the OCR-dependent spec cases run
instead of skipping — run the suite here, not on the host, or those cases skip
silently.

## Execute the experiment matrix

In the console, the matrix view shows the 3×4 grid of briefs × topologies.
Start runs from there (or `POST /api/runs`); the server answers immediately and
a background worker executes the batch while the UI polls progress. With the
mock provider a full 36-run matrix takes seconds.

Each cell's colour is that run-group's set coherence; click through to a run to
see its artifacts, per-artifact scores, and the execution trace.

## Re-run or re-score a run

From a run's detail page (or the API): **rerun** starts a new run of the same
brief/topology/rep — reusing the recorded seed (byte-identical under the mock)
or drawing a fresh one; **recompute** re-runs only the metrics over the stored
artifacts and trace, which is the tool of choice after changing a metric
implementation.

## Hold a review round with raters

1. Set an admin token and restart, so raters cannot open the researcher API:
   set `GRAIN_ADMIN_TOKEN` in the compose environment. The console asks for
   the token once; rater links keep working without it.
2. In the review view, create the plan. It derives the A/B pairs and rubric
   assignments (including controls, anchors, and scrambles) from the finished
   matrix runs.
3. Create one session per rater; each gets a code. Send each rater
   `http://<host>:8000/review/?code=<their code>`.
4. Raters vote and rate blind — nothing in their view names a topology or a
   run. Progress and results (win rates with intervals, agreement statistics,
   catch validity) appear in the review view as sessions complete.

## Reset the data

All state lives in the data directory. Stop the app and delete it:

```sh
docker compose down
rm -rf data
```

This discards runs, metrics, review plans, and votes. There is no partial
reset; delete individual runs from the console instead if that is enough.

## Add a real provider

The provider seam is the one place model access lives. A provider is one class
implementing the `Provider` protocol from `providers/base.py` — two methods
over frozen request/response dataclasses:

```python
# src/grain/providers/azure.py
from grain.providers.base import (
    ChatRequest, ChatResponse, ImageRequest, ImageResponse,
)


class AzureProvider:
    name = "azure"

    def chat(self, request: ChatRequest) -> ChatResponse:
        # request.role is director | producer | critic | judge_viescore |
        # judge_coherence; judge requests carry request.images as vision
        # input. Echo the prompt into ChatResponse.prompt for the trace
        # drill-down.
        ...

    def image(self, request: ImageRequest) -> ImageResponse:
        ...
```

Register it in `providers/registry.py` — one entry in the `factories` dict —
and select it with `GRAIN_PROVIDER=azure`.

Nothing else changes: executors, metrics, review, and analysis are
provider-agnostic. Report **measured** `duration_s` values: they place each
call on the virtual timeline behind the latency metric
([architecture](architecture.md#trace-and-latency)), which the mock feeds
with simulated durations today.
