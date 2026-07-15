"""Fine: Coarse plus the evaluator-optimizer loop (concept/01). The critic sees
the whole set and sends drifting artifacts back; the termination rule lives in
stopping.py. Fine delivers the version it stopped on — no best-of selection."""

from grain.agents.messages import SetCritique, SharedConcept
from grain.agents.roles import CriticAgent
from grain.domain.platforms import PLATFORMS, platform
from grain.harness.seeds import call_seed
from grain.topologies import coarse
from grain.topologies.execution import Draft, Execution, Outcome, produce_artifact, record_chat
from grain.topologies.proxy import proxy_score
from grain.topologies.stopping import should_stop


def review_set(execution: Execution, concept: SharedConcept, drafts: dict[str, Draft],
               round_: int) -> tuple[SetCritique, int]:
    images = tuple(drafts[spec.id].image_path for spec in PLATFORMS)
    seed = call_seed(execution.run_seed, f"critic:{round_}")
    critique, response = CriticAgent(execution.provider).review(
        execution.brief, concept, images, seed,
    )
    idx = record_chat(
        execution, response, role="critic", agent="critic", purpose="coordination",
        round_=round_, seed=seed,
        parents=tuple(draft.image_idx for draft in drafts.values()),
    )
    return critique, idx


def run(execution: Execution) -> Outcome:
    concept, drafts = coarse.initial_production(execution)

    sets_by_round = {0: dict(drafts)}
    proxies = {0: proxy_score([d.image_path for d in drafts.values()])}
    round_ = 0
    while True:
        critique, critic_idx = review_set(execution, concept, drafts, round_)
        decision = should_stop(critique, round_, proxies)
        if decision.stop:
            return Outcome(sets_by_round, round_, decision.reason, proxies)
        if not critique.feedback:
            # A rejection must name the drifted artifacts, or the loop would
            # spin a revision round that revises nothing.
            raise ValueError("critic rejected the set without feedback")

        next_round = round_ + 1
        for pid, instruction in critique.feedback.items():
            drafts[pid] = produce_artifact(
                execution, platform(pid), concept=concept, feedback=instruction,
                round_=next_round, parents=(critic_idx,),
            )
        round_ = next_round
        sets_by_round[round_] = dict(drafts)
        proxies[round_] = proxy_score([d.image_path for d in drafts.values()])
