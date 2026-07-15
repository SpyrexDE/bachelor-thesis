"""Set coherence (concept/03): one holistic VLM-judge call over the whole set,
pillar sub-scores 0-5, the set's score is the minimum (conjunctive rubric)."""

from pathlib import Path

from grain.domain.brief import Brief
from grain.harness.seeds import call_seed
from grain.metrics.judging import coherence_prompt, judge_order
from grain.providers.base import ChatRequest, Provider, parse_json_block


def score_set(provider: Provider, brief: Brief, images: dict[str, Path],
              run_seed: int, seed_key: str) -> dict:
    seed = call_seed(run_seed, seed_key)
    order = judge_order(seed)
    response = provider.chat(ChatRequest(
        prompt=coherence_prompt(brief, order),
        role="judge_coherence",
        seed=seed,
        images=tuple(images[pid] for pid in order),
    ))
    payload = parse_json_block(response.text)
    pillars = payload["pillars"]
    return {
        # min over pillars: one broken pillar breaks the campaign (concept/03).
        "value": float(min(pillars.values())),
        "pillars": pillars,
        "justifications": payload["justifications"],
        "artifact_order": order,
        "judge_seed": seed,  # every call's seed is recorded (concept/02)
    }
