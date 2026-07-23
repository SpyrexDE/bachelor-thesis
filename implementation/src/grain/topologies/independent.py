"""Independent: parallelization in its sectioning variant (concept/01) — each
producer works from the brief alone; no director, no contact, nothing
aligns their three readings of the same brief."""

from grain.domain.platforms import PLATFORMS
from grain.topologies.execution import Execution, Outcome, produce_artifact


def run(execution: Execution) -> Outcome:
    drafts = {spec.id: produce_artifact(execution, spec) for spec in PLATFORMS}
    return Outcome(sets_by_round={0: drafts}, final_round=0)
