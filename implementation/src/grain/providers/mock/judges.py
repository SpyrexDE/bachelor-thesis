"""Mock VLM judges: VIEScore per artifact, set coherence over the whole set.

Scores derive from measurable features of the artifacts (manifest text, palette,
text boxes) against the brief in the prompt, plus a small seeded jitter — so the
numbers demonstrate the pipeline, not findings (docs/decisions.md D5). Formulas
(min rules, geometric mean) are applied downstream in metrics/, not here: like
the real judges, these return sub-scores with rationales.
"""

from pathlib import Path
from random import Random

from grain.domain.platforms import outside_safe_zone, platform
from grain.providers.mock import lexicon
from grain.providers.mock.agents import fenced, jaccard
from grain.providers.mock.sections import brief_field, brief_list_field, section
from grain.providers.mock.vision import read_manifest


def clamp(value: float, low: int, high: int) -> int:
    return int(max(low, min(high, round(value))))


def artifact_terms(manifest: dict) -> set[str]:
    text = " ".join(
        filter(None, (manifest["headline"], manifest["kicker"], manifest["claim_line"]))
    )
    return set(lexicon.terms(text))


def carries_claim(claim: str, terms: set[str]) -> bool:
    wanted = set(lexicon.terms(claim))
    return bool(wanted) and len(wanted & terms) / len(wanted) >= 0.8


def text_boxes_outside_safe_zone(manifest: dict) -> list[str]:
    spec = platform(manifest["platform"])
    if spec.safe_zone is None:
        return []
    width, height = manifest["canvas"]
    return [
        entry["text"]
        for entry in manifest["text_boxes"]
        if outside_safe_zone(tuple(entry["box"]), width, height, spec.safe_zone)
    ]


def viescore(prompt: str, seed: int, images: tuple[Path, ...]) -> str:
    # A single-artifact image metric (concept/03, VIEScore).
    rng = Random(seed)
    brief_text = section(prompt, "brief")
    claim = (brief_list_field(brief_text, "Required claims") or [""])[0]
    benefit_terms = set(lexicon.terms(brief_field(brief_text, "Key benefit / major selling idea")))

    manifest = read_manifest(images[0])
    spec = platform(manifest["platform"])
    terms = artifact_terms(manifest)

    coverage = len(benefit_terms & terms) / len(benefit_terms) if benefit_terms else 0.0
    has_claim = carries_claim(claim, terms)
    brief_fit = clamp((7 if has_claim else 3) + coverage * 3 + rng.choice((-1, 0, 0, 1)), 0, 10)

    platform_fit = 8
    issues: list[str] = []
    offenders = text_boxes_outside_safe_zone(manifest)
    if offenders:
        platform_fit = 4
        issues.append(f'text outside the safe area ("{offenders[0]}")')
    text_lines = len(manifest["text_boxes"])
    if spec.id == "banner" and text_lines > 4:
        platform_fit -= 2
        issues.append("crowded for a 300x250 unit")
    platform_fit = clamp(platform_fit + rng.choice((-1, 0, 0, 1)), 0, 10)

    naturalness = clamp(6 + rng.randint(0, 3) - (2 if text_lines > 4 else 0), 0, 10)
    artifact_freeness = clamp(6 + rng.randint(0, 3), 0, 10)

    return fenced({
        "semantic_consistency": {"brief_fit": brief_fit, "platform_fit": platform_fit},
        "perceptual_quality": {"naturalness": naturalness, "artifact_freeness": artifact_freeness},
        "rationales": {
            "brief_fit": (
                f"{'Carries' if has_claim else 'Misses'} the required claim; "
                f"benefit wording coverage {coverage:.0%}."
            ),
            "platform_fit": "; ".join(issues) if issues else "format and layout fit the platform",
            "naturalness": "clean synthetic render" + (", crowded layout" if text_lines > 4 else ""),
            "artifact_freeness": "no rendering artifacts visible",
        },
    })


def coherence(prompt: str, seed: int, images: tuple[Path, ...]) -> str:
    rng = Random(seed)
    brief_text = section(prompt, "brief")
    claim = (brief_list_field(brief_text, "Required claims") or [""])[0]

    manifests = [read_manifest(path) for path in images]
    term_sets = [artifact_terms(m) for m in manifests]
    carriers = sum(carries_claim(claim, terms) for terms in term_sets)
    pairs = [(0, 1), (0, 2), (1, 2)]
    overlap = sum(jaccard(term_sets[a], term_sets[b]) for a, b in pairs) / len(pairs)

    key_message = {3: 4, 2: 3, 1: 2, 0: 1}[carriers]
    if overlap >= 0.35:
        key_message += 1
    if overlap < 0.15:
        key_message -= 1

    palettes = {tuple(m["palette"]) for m in manifests}
    brand_blocks = sum(1 for m in manifests if m["brand"])
    brand_cues = {1: 4, 2: 2, 3: 1}[len(palettes)]
    if brand_blocks == 3:
        brand_cues += 1

    styles = {tuple(m["style"]) for m in manifests}
    tone = 5 - (len(styles) - 1) * 2 - (1 if overlap < 0.15 else 0)

    jitter = rng.choice((0, 0, 0, -1, 1))
    pillars = {
        "key_message": clamp(key_message + jitter, 0, 5),
        "brand_cues": clamp(brand_cues, 0, 5),
        "tone": clamp(tone, 0, 5),
    }

    drift_note = ""
    if len(palettes) > 1:
        outlier = next(
            m for m in manifests if sum(tuple(n["palette"]) == tuple(m["palette"]) for n in manifests) == 1
        )
        drift_note = f" The {platform(outlier['platform']).label} departs from the shared palette."
    return fenced({
        "pillars": pillars,
        "justifications": {
            "key_message": (
                f"The required claim is visible on {carriers} of 3 artifacts; "
                f"message wording overlaps at {overlap:.0%} across formats."
            ),
            "brand_cues": (
                f"{len(palettes)} palette(s) across the set, brand block on "
                f"{brand_blocks} of 3 artifacts.{drift_note}"
            ),
            "tone": f"{len(styles)} visual register(s) across the set.",
        },
    })
