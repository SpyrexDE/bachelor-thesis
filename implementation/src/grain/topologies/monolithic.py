"""Monolithic: one agent writes the whole set in a single context (concept/01).
The single-agent baseline that MAS studies compare against."""

from grain.agents.roles import SetProducerAgent
from grain.domain.platforms import PLATFORMS
from grain.harness.seeds import call_seed
from grain.topologies.execution import Execution, Outcome, materialize, record_chat


def run(execution: Execution) -> Outcome:
    seed = call_seed(execution.run_seed, "producer:all:0")
    plans, response = SetProducerAgent(execution.provider).produce_set(execution.brief, seed)
    producer_idx = record_chat(
        execution, response, role="producer", agent="producer:all",
        purpose="production", round_=0, seed=seed, parents=(),
    )
    drafts = {
        plan.platform: materialize(execution, spec, plan, 0, producer_idx)
        for spec, plan in zip(PLATFORMS, plans)
    }
    return Outcome(sets_by_round={0: drafts}, final_round=0)
