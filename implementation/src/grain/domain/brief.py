from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass(frozen=True)
class Mandatories:
    required_claims: tuple[str, ...]
    prohibited_wording: tuple[str, ...]


@dataclass(frozen=True)
class Brief:
    # The ten creative-brief elements: concept/02, Brief (Belch & Belch plus mandatories).
    id: str
    brand: str
    product: str
    problem: str
    objectives: str
    audience: str
    insight: str
    key_benefit: str
    reason_to_believe: str
    tone: str
    deliverables: str
    success_measures: str
    mandatories: Mandatories

    def as_text(self) -> str:
        # The wording an agent reads; every element present, none topology-dependent.
        lines = [
            f"Brand: {self.brand}",
            f"Product: {self.product}",
            f"Problem: {self.problem}",
            f"Communication objectives: {self.objectives}",
            f"Target audience: {self.audience}",
            f"Insight: {self.insight}",
            f"Key benefit / major selling idea: {self.key_benefit}",
            f"Reason to believe: {self.reason_to_believe}",
            f"Tone and manner: {self.tone}",
            f"Deliverables: {self.deliverables}",
            f"Measures of success: {self.success_measures}",
            "Mandatories:",
            f"  Required claims: {'; '.join(self.mandatories.required_claims)}",
            f"  Prohibited wording: {'; '.join(self.mandatories.prohibited_wording)}",
        ]
        return "\n".join(lines)


def load_brief(path: Path) -> Brief:
    raw = yaml.safe_load(path.read_text())
    mandatories = raw.pop("mandatories")
    return Brief(
        mandatories=Mandatories(
            required_claims=tuple(mandatories["required_claims"]),
            prohibited_wording=tuple(mandatories["prohibited_wording"]),
        ),
        **raw,
    )


def load_briefs(briefs_dir: Path) -> dict[str, Brief]:
    briefs = {}
    for path in sorted(briefs_dir.glob("*.yaml")):
        brief = load_brief(path)
        briefs[brief.id] = brief
    if not briefs:
        raise FileNotFoundError(f"no brief fixtures in {briefs_dir}")
    return briefs
