"""Coarse: a centralised communication structure (Guo 2024, concept/01): the
creative director emits one shared concept, then producers work in parallel with
no contact. The decomposition is fixed and nothing synthesises the outputs — so
it is deliberately not the (dynamic) orchestrator-workers pattern."""

from grain.agents.messages import SharedConcept
from grain.agents.roles import CreativeDirectorAgent
from grain.domain.platforms import PLATFORMS
from grain.harness.seeds import call_seed
from grain.topologies.execution import Draft, Execution, Outcome, produce_artifact, record_chat


def emit_concept(execution: Execution) -> tuple[SharedConcept, int]:
    seed = call_seed(execution.run_seed, "director:0")
    concept, response = CreativeDirectorAgent(execution.provider).emit_concept(execution.brief, seed)
    idx = record_chat(
        execution, response, role="director", agent="director",
        purpose="coordination", round_=0, seed=seed, parents=(),
    )
    return concept, idx


def initial_production(execution: Execution) -> tuple[SharedConcept, dict[str, Draft]]:
    concept, director_idx = emit_concept(execution)
    drafts = {
        spec.id: produce_artifact(execution, spec, concept=concept, parents=(director_idx,))
        for spec in PLATFORMS
    }
    return concept, drafts


def run(execution: Execution) -> Outcome:
    _, drafts = initial_production(execution)
    return Outcome(sets_by_round={0: drafts}, final_round=0)
