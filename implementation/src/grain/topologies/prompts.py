"""Role prompts, shared across topologies.

Fair comparison (concept/01): the producer instruction is one template for every
topology. Coarse and Fine fill the concept slot, Independent leaves it out (that
absence is the manipulation), Monolithic is the Independent variant combined
into one prompt — no concept slot and no explicit coherence instruction, so its
coherence can come only from the shared context. Tests pin these relations.
"""

from grain.domain.brief import Brief
from grain.domain.platforms import PLATFORMS, PlatformSpec

PRODUCER_TASK = (
    "Produce the artifact for your platform. Respond as fenced JSON with an "
    '"image_prompt" (a complete instruction for the image model: palette with two '
    "hex values, motif, any on-image text in double quotes, style, brand block, "
    "layout). Respect the platform limits and the brief's mandatories."
)

MONOLITHIC_TASK = (
    "Produce the artifacts for all three platforms. Respond as fenced JSON keyed "
    'by platform id ("instagram", "story", "banner"), each entry with an '
    '"image_prompt" (a complete instruction for the image model: palette with two '
    "hex values, motif, any on-image text in double quotes, style, brand block, "
    "layout). Respect the platform limits and the brief's mandatories."
)

ORCHESTRATOR_TASK = (
    "Turn the brief into one platform-agnostic shared creative concept: the "
    "single idea the whole set is built on. Respond as fenced JSON with "
    '"angle", "angle_direction", "palette" (name and two hex colors), "motif", '
    '"tagline_direction", and "key_visual_direction". Do not produce artifacts.'
)

CRITIC_TASK = (
    "Check the whole set for cross-platform coherence against the shared "
    "creative concept: one key message, consistent brand cues, one tone; the "
    "visual format is expected to differ per platform. Respond as fenced JSON "
    '{"coherent": true|false, "feedback": {...}} where feedback maps the platform '
    'id of every artifact that drifted from the shared concept ("instagram", '
    '"story", "banner") to a concrete revision instruction; leave feedback empty '
    "when the set is coherent."
)


def platform_block(spec: PlatformSpec) -> str:
    lines = [f"{spec.label}. Image {spec.width}x{spec.height}. All copy lives in the image."]
    if spec.safe_zone is not None:
        zone = spec.safe_zone
        lines.append(
            f"On-image text stays inside the safe area: {zone.top:.0%} of the top, "
            f"{zone.bottom:.0%} of the bottom, and {zone.side:.0%} per side stay free."
        )
    if spec.id == "banner":
        lines.append("File up to 150 KB; keep the copy minimal.")
    return "\n".join(lines)


def producer_prompt(brief: Brief, spec: PlatformSpec, concept: str | None = None,
                    feedback: str | None = None) -> str:
    parts = [
        f"You are the {spec.label} producer for a marketing campaign.",
        "## Brief\n" + brief.as_text(),
        "## Platform\n" + platform_block(spec),
    ]
    if concept is not None:
        parts.append("## Shared creative concept\n" + concept)
    if feedback is not None:
        parts.append("## Revision feedback\n" + feedback)
    parts.append("## Task\n" + PRODUCER_TASK)
    return "\n\n".join(parts)


def monolithic_prompt(brief: Brief) -> str:
    parts = [
        "You are the producer for a marketing campaign.",
        "## Brief\n" + brief.as_text(),
    ]
    for spec in PLATFORMS:
        parts.append(f"## Platform: {spec.label}\n" + platform_block(spec))
    parts.append("## Task\n" + MONOLITHIC_TASK)
    return "\n\n".join(parts)


def orchestrator_prompt(brief: Brief) -> str:
    return "\n\n".join([
        "You are the campaign orchestrator.",
        "## Brief\n" + brief.as_text(),
        "## Task\n" + ORCHESTRATOR_TASK,
    ])


def artifacts_block() -> str:
    return "\n".join(f"{spec.label}." for spec in PLATFORMS)


def critic_prompt(brief: Brief, concept: str) -> str:
    return "\n\n".join([
        "You are the campaign critic.",
        "## Brief\n" + brief.as_text(),
        "## Shared creative concept\n" + concept,
        "## Artifacts\n" + artifacts_block(),
        "## Task\n" + CRITIC_TASK,
    ])
