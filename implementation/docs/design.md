# Design

`grain` is the implementation half of a bachelor thesis on **task granularity in
multi-agent LLM systems**. The experiment behind it: give the same campaign brief
to four agent topologies — from a single monolithic call up to a fine-grained
director/producer/critic loop — and measure what granularity changes about the
quality, coherence, cost, and speed of the resulting multi-platform ad-artifact
sets.

[`../concept/`](../concept/) is the specification. This code executes it and is
pinned to it: the rules the concept fixes (metric formulas, fairness constraints
between topologies, the stopping rule) are enforced by
[`tests/test_concept_invariants.py`](../tests/test_concept_invariants.py), so the
implementation cannot drift from the study design unnoticed.

## What it is

- **An experiment harness.** Four topology executors run the full design — 3
  briefs × 4 topologies × 3 repetitions — with every model call recorded: role,
  seed, token counts, duration, and which calls it waited for. A run with the
  same seed reproduces byte-for-byte.
- **An evaluation platform.** Five machine metrics (coordination tax, VIEScore,
  set coherence, spec compliance, latency), a blind human-review flow (A/B
  votes and rubric ratings), and the analysis that answers the research
  question (effect sizes, Pareto frontier, revision-round curve).
- **One deployable unit.** A single FastAPI process serving two vanilla-JS UIs
  (researcher console and rater view), SQLite plus artifact files on disk, one
  container image.

## What it isn't

- **Not an agent framework.** There is no AutoGen, LangGraph, or comparable
  runtime underneath. Topologies are fixed wiring walked by plain code; the
  one model-driven branch is the critic's accept/revise verdict, and even that
  loop's termination is pinned in code and tests. This is deliberate: the study
  *manipulates* the decomposition, so the decomposition skeleton must be exact,
  token counting must be complete (coordination tax is a headline metric), and
  runs must replay from recorded seeds. A framework runtime would own precisely
  those three things. The role/message/termination decomposition follows Dibia,
  *Designing Multi-Agent Systems* (2025), without adopting its runtime.
- **Not a product.** No accounts, no multi-tenancy, one experiment at a time,
  one background worker. The full design is 36 runs.

## Trade-offs, owned

- **The mock is information-flow-faithful.** It never hardcodes topology
  outcomes. Each mock producer derives its choices only from what that call can
  actually see (brief, shared concept if present, critic feedback if present),
  so divergence between independent producers and alignment under a director
  *emerge* from information flow — the same mechanism the real system will
  have, which is what makes the pipeline worth demonstrating before real
  providers exist.
- **Latency is computed, not clocked.** Wall-clock time of the harness would
  measure the host's scheduling, and mock runs finish in milliseconds. Instead
  every call carries a duration (measured for real providers, simulated with
  plausible magnitudes for the mock) and latency is the critical path over the
  call graph — parallel producers count once, chained rounds add up.
- **Statistics are implemented by hand.** Spearman, Cohen's kappa, Wilson
  intervals, effect sizes — no scipy. Every reported number can be explained
  line by line, and each implementation is tested against hand-worked examples.
- **Spec compliance reads the image, not the prompt.** Required claims and
  prohibited wording are checked by OCR (tesseract) on the rendered artifact —
  what a viewer would actually see — not by trusting the text the model claimed
  to place. Known limit: below roughly ten characters of isolated small-print,
  OCR recall falls off; accepted because no artifact the mock produces lands
  there, revisited when a real image provider arrives.
- **Blinding outranks convenience.** Raters enter through a session code and
  see nothing that names a topology, a run, or whether a set is real, scrambled,
  or an anchor. Because raters and the researcher share one server, an optional
  admin token gates the researcher API — without it, a curious rater could
  unblind themselves.
