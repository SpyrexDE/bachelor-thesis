"""Prompt builders for the official judges.

The official set-coherence rubric lives here and nowhere else; the in-loop
proxy (topologies/proxy.py) must never import from this module (concept/01
validity caution).
"""

from random import Random

from grain.domain.brief import Brief
from grain.domain.platforms import PLATFORMS, PlatformSpec
from grain.topologies.prompts import platform_block

# Concept/03, Set coherence: three pillars, 0-5 each, reference-free against the
# brief; format differences per platform are expected, sameness is not the goal.
COHERENCE_RUBRIC = """Score each pillar from 0 (broken) to 5 (fully held), with a justification:

Key message: the finished set carries one message, judged against the brief's key
benefit / major selling idea. Not against any internal concept document.

Brand cues: consistent brand signals across the set — palette, brand presence,
mandatory brand elements.

Tone: one tone and manner across the set, the one the brief asks for.

The visual format is expected to differ per platform; judge whether the campaign
holds together across that adaptation, not whether the images look the same."""

VIESCORE_TASK = (
    "Rate this artifact's image. Respond as fenced JSON with "
    '"semantic_consistency" sub-scores {"brief_fit", "platform_fit"} and '
    '"perceptual_quality" sub-scores {"naturalness", "artifact_freeness"}, each '
    '0 to 10, plus "rationales" with a short sentence per sub-score.'
)

COHERENCE_TASK = (
    "Judge whether the three artifacts form one campaign for this brief. Respond "
    'as fenced JSON with "pillars" {"key_message", "brand_cues", "tone"}, each 0 '
    'to 5, and "justifications" with a short sentence per pillar.'
)


def viescore_prompt(brief: Brief, spec: PlatformSpec) -> str:
    return "\n\n".join([
        "You are scoring a single campaign artifact with VIEScore.",
        "## Brief\n" + brief.as_text(),
        "## Platform\n" + platform_block(spec),
        "## Task\n" + VIESCORE_TASK,
    ])


def coherence_prompt(brief: Brief, captions: dict[str, str | None],
                     order: list[str]) -> str:
    # Artifact order is randomised per call against position bias (concept/03).
    labels = {spec.id: spec.label for spec in PLATFORMS}
    blocks = []
    for pid in order:
        if captions.get(pid):
            blocks.append(f"{labels[pid]} caption:\n{captions[pid]}\n")
        else:
            blocks.append(f"{labels[pid]}: no caption.\n")
    return "\n\n".join([
        "You are the set-coherence judge for a campaign artifact set.",
        "## Brief\n" + brief.as_text(),
        "## Rubric\n" + COHERENCE_RUBRIC,
        "## Artifacts\n" + "\n".join(blocks).strip(),
        "## Task\n" + COHERENCE_TASK,
    ])


def judge_order(seed: int) -> list[str]:
    order = [spec.id for spec in PLATFORMS]
    Random(seed).shuffle(order)
    return order
