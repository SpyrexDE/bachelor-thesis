"""Mock orchestrator, producer, and critic.

Each behaviour reads only its prompt (and attached images) and derives every
choice from its call seed. The probabilities below apply identically in every
topology; coherence differences must emerge from what a call can see
(docs/decisions.md D5).
"""

import json
import re
from pathlib import Path
from random import Random

from grain.domain.platforms import PLATFORMS
from grain.providers.mock import copy as copywriting
from grain.providers.mock import lexicon
from grain.providers.mock.sections import (
    brief_field,
    brief_list_field,
    parse_json_block,
    platform_sections,
    section,
)
from grain.providers.mock.vision import read_manifest

ADHERENCE = 0.80          # producer applies the shared concept fully (concept/01: executions can drift)
FEEDBACK_COMPLIANCE = 0.90
CLAIM_INCLUSION = 0.85    # required claim makes it into the artifact's text
KICKER_PRESENCE = 0.50
PROHIBITED_SLIP = 0.06    # wording slip that lands on a prohibited term
SAFE_ZONE_SLIP = 0.12     # story text placed outside the safe area

DRIFT_JACCARD = 0.22      # critic: below this message overlap an artifact has drifted


def fenced(payload: dict) -> str:
    return "```json\n" + json.dumps(payload, indent=2) + "\n```"


def read_brief_fields(brief_text: str) -> dict:
    claims = brief_list_field(brief_text, "Required claims")
    benefit_line = brief_field(brief_text, "Key benefit / major selling idea")
    return {
        "brand": brief_field(brief_text, "Brand"),
        "product": brief_field(brief_text, "Product"),
        "tone": lexicon.tone_key(brief_field(brief_text, "Tone and manner")),
        "benefit": copywriting.benefit_short(benefit_line),
        "claim": claims[0] if claims else "",
        "prohibited": brief_list_field(brief_text, "Prohibited wording"),
        "num": copywriting.number_phrase(
            benefit_line + " " + "; ".join(claims), brief_text
        ),
    }


def creative_choice(brand: str, rng: Random) -> dict:
    key = lexicon.brand_key(brand)
    angle = rng.choice(sorted(lexicon.ANGLES))
    palette_name, colors = rng.choice(lexicon.PALETTES[key])
    return {
        "angle": angle,
        "angle_direction": lexicon.ANGLES[angle],
        "palette": {"name": palette_name, "colors": list(colors)},
        "motif": rng.choice(lexicon.MOTIFS[key]),
    }


def drifted_choice(choice: dict, brand: str, rng: Random) -> dict:
    # Execution drift: the producer departs from the concept on one dimension.
    key = lexicon.brand_key(brand)
    drifted = dict(choice)
    if rng.random() < 0.5:
        others = [a for a in sorted(lexicon.ANGLES) if a != choice["angle"]]
        drifted["angle"] = rng.choice(others)
        drifted["angle_direction"] = lexicon.ANGLES[drifted["angle"]]
    else:
        others = [p for p in lexicon.PALETTES[key] if p[0] != choice["palette"]["name"]]
        name, colors = rng.choice(others)
        drifted["palette"] = {"name": name, "colors": list(colors)}
    return drifted


def orchestrate(prompt: str, seed: int) -> str:
    rng = Random(seed)
    brief_text = section(prompt, "brief")
    fields = read_brief_fields(brief_text)
    choice = creative_choice(fields["brand"], rng)
    choice["tagline_direction"] = (
        f"Short {fields['tone']} lines that {choice['angle_direction']}"
    )
    choice["key_visual_direction"] = (
        f"{choice['motif']}, {choice['palette']['name']} palette, recomposed per format"
    )
    return fenced(choice)


def platform_id(section_text: str) -> str:
    for spec in PLATFORMS:
        if spec.label.lower() in section_text.lower():
            return spec.id
    raise ValueError(f"no known platform in section: {section_text[:80]}")


def parse_feedback_target(feedback: str, brand: str) -> dict | None:
    angle = re.search(r"angle '(\w+)'", feedback)
    palette = re.search(r"palette '([^']+)'", feedback)
    motif = re.search(r"motif '([^']+)'", feedback)
    if not (angle and palette and motif):
        return None
    key = lexicon.brand_key(brand)
    colors = next(
        (list(c) for name, c in lexicon.PALETTES[key] if name == palette.group(1)), None
    )
    if colors is None or angle.group(1) not in lexicon.ANGLES:
        return None
    return {
        "angle": angle.group(1),
        "angle_direction": lexicon.ANGLES[angle.group(1)],
        "palette": {"name": palette.group(1), "colors": colors},
        "motif": motif.group(1),
    }


def artifact_plan(pid: str, choice: dict, fields: dict, rng: Random) -> dict:
    tone = fields["tone"]
    head = copywriting.headline(choice["angle"], tone, fields, rng)
    claim_line = fields["claim"] if rng.random() < CLAIM_INCLUSION else None
    slip_word = None
    if fields["prohibited"] and rng.random() < PROHIBITED_SLIP:
        slip_word = rng.choice(fields["prohibited"])
    kicker = None
    if slip_word:
        kicker = f"Practically {slip_word}."
    elif rng.random() < KICKER_PRESENCE:
        kicker = f"{fields['benefit']}."

    violate_safe_zone = pid == "story" and rng.random() < SAFE_ZONE_SLIP
    return {
        "image_prompt": image_prompt(pid, choice, fields, head, kicker, claim_line, violate_safe_zone),
    }


def image_prompt(pid: str, choice: dict, fields: dict, head: str,
                 kicker: str | None, claim_line: str | None, violate_safe_zone: bool) -> str:
    spec = next(s for s in PLATFORMS if s.id == pid)
    palette = choice["palette"]
    style = ", ".join(lexicon.TONE_STYLES[fields["tone"]])
    parts = [
        f"{spec.label} creative, {spec.width}x{spec.height}.",
        f"Palette: {palette['name']} ({palette['colors'][0]}, {palette['colors'][1]}).",
        f"Motif: {choice['motif']}.",
        f'Headline on image: "{head}".',
    ]
    if kicker:
        parts.append(f'Kicker line: "{kicker}".')
    if claim_line:
        parts.append(f'Claim line: "{claim_line}".')
    parts.append(f"Style: {style}.")
    parts.append(f"Brand block: {fields['brand']} wordmark.")
    if spec.safe_zone is not None:
        if violate_safe_zone:
            parts.append("Place the claim line at the very bottom edge of the frame.")
        else:
            parts.append(
                "Keep all text inside the safe area: top 14%, bottom 35%, sides 6% stay free."
            )
    return " ".join(parts)


def produce(prompt: str, seed: int) -> str:
    rng = Random(seed)
    fields = read_brief_fields(section(prompt, "brief"))
    platforms = [platform_id(body) for _, body in platform_sections(prompt)]

    concept_text = section(prompt, "shared creative concept")
    feedback_text = section(prompt, "revision feedback")

    if concept_text is not None:
        choice = parse_json_block(concept_text)
        if rng.random() >= ADHERENCE:
            choice = drifted_choice(choice, fields["brand"], rng)
    else:
        # No shared concept in sight (Independent, Monolithic): the producer's own
        # reading of the brief decides. One call, one choice.
        choice = creative_choice(fields["brand"], rng)

    if feedback_text is not None:
        target = parse_feedback_target(feedback_text, fields["brand"])
        if target is not None and rng.random() < FEEDBACK_COMPLIANCE:
            choice = {**choice, **target}

    plans = {pid: artifact_plan(pid, choice, fields, rng) for pid in platforms}
    if len(platforms) == 1:
        return fenced(plans[platforms[0]])
    return fenced(plans)


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def critique(prompt: str, seed: int, images: tuple[Path, ...]) -> str:
    del seed  # the critic's verdict is a deterministic read of the set
    concept = parse_json_block(section(prompt, "shared creative concept"))
    manifests = [read_manifest(path) for path in images]
    platforms = [m["platform"] for m in manifests]

    term_sets = [
        set(lexicon.terms(" ".join(filter(None, (m["headline"], m["kicker"], m["claim_line"])))))
        for m in manifests
    ]
    drifted: dict[str, str] = {}
    for i, manifest in enumerate(manifests):
        palette_off = manifest["palette"] != concept["palette"]["colors"]
        others = term_sets[:i] + term_sets[i + 1:]
        overlap = sum(jaccard(term_sets[i], other) for other in others) / len(others)
        if palette_off or overlap < DRIFT_JACCARD:
            palette = concept["palette"]
            drifted[platforms[i]] = (
                f"Align to the shared concept: use the '{concept['angle']}' angle "
                f"({concept['angle_direction']}), palette '{palette['name']}' "
                f"({palette['colors'][0]}, {palette['colors'][1]}), motif '{concept['motif']}'. "
                "Keep the platform's format rules."
            )

    return fenced({"coherent": not drifted, "feedback": drifted})
