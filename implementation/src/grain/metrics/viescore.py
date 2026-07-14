"""VIEScore per artifact (concept/03): sub-scores from a VLM judge, the overall
score computed here with the published formula (Ku 2024)."""

import math
from pathlib import Path

from grain.domain.brief import Brief
from grain.domain.platforms import PlatformSpec
from grain.harness.seeds import call_seed
from grain.metrics.judging import viescore_prompt
from grain.providers.base import ChatRequest, Provider, parse_json_block


def overall(semantic: dict[str, int], perceptual: dict[str, int]) -> float:
    # O = sqrt(min(SC) * min(PQ)): one zero sub-score zeroes its axis, and a zero
    # axis zeroes the artifact (concept/03).
    return round(math.sqrt(min(semantic.values()) * min(perceptual.values())), 4)


def score_artifact(provider: Provider, brief: Brief, spec: PlatformSpec,
                   image_path: Path, run_seed: int) -> dict:
    seed = call_seed(run_seed, f"judge:viescore:{spec.id}")
    response = provider.chat(ChatRequest(
        prompt=viescore_prompt(brief, spec),
        role="judge_viescore",
        seed=seed,
        images=(image_path,),
    ))
    payload = parse_json_block(response.text)
    semantic = payload["semantic_consistency"]
    perceptual = payload["perceptual_quality"]
    return {
        "value": overall(semantic, perceptual),
        "semantic_consistency": semantic,
        "perceptual_quality": perceptual,
        "rationales": payload["rationales"],
        "judge_seed": seed,  # every call's seed is recorded (concept/02)
    }
