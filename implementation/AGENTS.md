# Agent notes

Instructions for coding agents working in `implementation/`.

- [`docs/.ai/conventions.md`](docs/.ai/conventions.md) is binding for every
  change. Read it before writing code.
- `../concept/` is the specification and is read-only from here; concept
  invariants are pinned in `tests/test_concept_invariants.py`.
- [`docs/.ai/decisions.md`](docs/.ai/decisions.md) is the append-only decision
  log; add a dated entry when a choice locks.
- UI work follows [`docs/.ai/ui-method.md`](docs/.ai/ui-method.md); visible
  properties are accounted for in [`docs/.ai/design-rationale.md`](docs/.ai/design-rationale.md).
- Tests run in the container, never on the host:
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm grain pytest`
- `README.md` and `docs/*.md` are human-facing documentation; binding rules
  live only under `docs/.ai/`.
