"""The messages that travel between agents.

The information flow between roles is the manipulated variable of the study
(concept/01), so it is typed and explicit. SharedConcept stays raw message
text: the wiring passes it through without interpreting it — only producers
read it, and the evaluation never sees it (concept/01, roles).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SharedConcept:
    text: str


@dataclass(frozen=True)
class ArtifactPlan:
    platform: str
    image_prompt: str
    caption: str | None


@dataclass(frozen=True)
class SetCritique:
    coherent: bool
    feedback: dict[str, str]  # platform id -> revision instruction, drifted artifacts only
