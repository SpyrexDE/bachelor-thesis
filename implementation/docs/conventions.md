# Conventions

Binding for every change in `implementation/`, whoever (or whatever) writes it.
The goal: code a human examiner can read, verify against `concept/`, and defend.

## Concept fidelity

- `concept/` is the spec and is read-only from here. When code implements a rule
  from the concept (a formula, a protocol step, an invariant), the comment names the
  source, e.g. `# min over pillars: concept/03, set coherence`. No other comment
  category is welcome by default.
- Concept invariants are pinned in `tests/test_concept_invariants.py`. Changing a
  pinned behaviour means the concept changed first — never the other way around.
- Open points the concept assigns to the implementation phase (in-loop proxy, judge
  model) are made explicit: one place in code, one entry in decisions.md.

## Code

- Plain Python, stdlib first. A new dependency needs a reason an examiner would
  accept; today's full list: fastapi, uvicorn, pillow, pytesseract, pyyaml (+ pytest,
  httpx for dev).
- Modules follow the domain, not patterns: no `utils.py`, `helpers.py`, `base.py`,
  `manager`/`service` names. A helper earns extraction on its second caller.
- Abstraction only at the two real seams (provider, store). Everything else is a
  function. No class where a function does.
- Comments explain *why* or cite the concept; never *what*. No section banners, no
  docstring that restates the signature, no TODO/FIXME left in committed code.
- Errors: raise early, no blanket `except`, no log-and-continue. If a run fails, the
  run row says so and the trace holds the error.
- Naming uses the concept's vocabulary verbatim: topology, brief, rep, producer,
  orchestrator, critic, pillar, anchor, scramble, step. No synonyms, no invented jargon.
- Type hints on module-level functions; no `TypeVar`/`Protocol` gymnastics beyond the
  provider seam.
- Determinism: anything seeded derives from the run seed via `harness/seeds.py`.
  Never call `random` module-level functions or the wall clock inside domain logic.

## Tests

- Pytest, plain asserts, no mocking frameworks; behaviour over units. Fixtures build
  real objects through the real code paths (mock provider is already fast and
  deterministic).
- Every metric formula has a test with hand-computed expected values.
- Statistics implemented by hand (Spearman, kappa, effect sizes) are tested against
  published or hand-worked examples.
- OCR-dependent tests skip cleanly when tesseract is absent; Docker CI always has it.

## Frontend

- Vanilla HTML/CSS/JS, ES modules, no framework, no CDN, no build step. One shared
  stylesheet; system font stack; the palette stays near-monochrome with one accent.
- The first glance must answer "what is this and what do I do here" without
  reading: one primary action per screen, states (empty/loading/running/failed)
  carried by color and icon, not by text alone.
- Icons are inline SVG (stroke, currentColor, web/admin/icons.js), and every icon
  is functional — it marks an action, a state, or an object type. Purely
  decorative graphics stay out; emoji stay banned everywhere.
- Raters stay blind: nothing in the review UI (markup, URLs, filenames, alt text)
  may leak topology, run identity, or set kind (real/scramble/anchor).
- Wording is terse and factual. No exclamation marks, no filler ("simply", "just"),
  no emoji anywhere in code, UI, or docs.

## Docs

- `docs/status.md` is updated whenever the working state changes; `docs/decisions.md`
  gets a dated entry when a choice locks. Both stay terse — bullet points, no prose
  padding, no restating the concept.
