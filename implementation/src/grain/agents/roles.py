"""The agent roles (concept/01): orchestrator, producer, critic.

An agent here is a model client plus role instructions plus an output parser —
nothing else. Agents are identical in every topology; what differs per topology
is the wiring in topologies/, which also owns seeds and telemetry. That
separation is what makes the fair comparison auditable: same roles, different
message flow.
"""

from pathlib import Path

from grain.agents.messages import ArtifactPlan, SetCritique, SharedConcept
from grain.domain.brief import Brief
from grain.domain.platforms import PLATFORMS, PlatformSpec
from grain.providers.base import ChatRequest, ChatResponse, Provider, parse_json_block
from grain.topologies.prompts import (
    critic_prompt,
    monolithic_prompt,
    orchestrator_prompt,
    producer_prompt,
)


class OrchestratorAgent:
    """Turns the brief into the one shared creative concept (Coarse, Fine)."""

    def __init__(self, provider: Provider):
        self.provider = provider

    def emit_concept(self, brief: Brief, seed: int) -> tuple[SharedConcept, ChatResponse]:
        response = self.provider.chat(ChatRequest(
            prompt=orchestrator_prompt(brief), role="orchestrator", seed=seed,
        ))
        return SharedConcept(response.text), response


class ProducerAgent:
    """Makes one platform's artifact plan from the full brief, its assignment,
    and whatever coordination input the topology grants it."""

    def __init__(self, provider: Provider, spec: PlatformSpec):
        self.provider = provider
        self.spec = spec

    def produce(self, brief: Brief, seed: int, concept: SharedConcept | None = None,
                feedback: str | None = None) -> tuple[ArtifactPlan, ChatResponse]:
        response = self.provider.chat(ChatRequest(
            prompt=producer_prompt(
                brief, self.spec,
                concept=concept.text if concept else None,
                feedback=feedback,
            ),
            role="producer", seed=seed,
        ))
        plan = parse_json_block(response.text)
        return ArtifactPlan(self.spec.id, plan["image_prompt"], plan.get("caption")), response


class SetProducerAgent:
    """The Monolithic single agent: the producer instruction combined into one
    prompt, all three plans from one context (concept/01, fair comparison)."""

    def __init__(self, provider: Provider):
        self.provider = provider

    def produce_set(self, brief: Brief, seed: int) -> tuple[list[ArtifactPlan], ChatResponse]:
        response = self.provider.chat(ChatRequest(
            prompt=monolithic_prompt(brief), role="producer", seed=seed,
        ))
        plans = parse_json_block(response.text)
        return [
            ArtifactPlan(spec.id, plans[spec.id]["image_prompt"], plans[spec.id].get("caption"))
            for spec in PLATFORMS
        ], response


class CriticAgent:
    """Reviews the whole set against the shared concept and names the artifacts
    that drifted (Fine only)."""

    def __init__(self, provider: Provider):
        self.provider = provider

    def review(self, brief: Brief, concept: SharedConcept,
               captions: dict[str, str | None], images: tuple[Path, ...],
               seed: int) -> tuple[SetCritique, ChatResponse]:
        response = self.provider.chat(ChatRequest(
            prompt=critic_prompt(brief, concept.text, captions),
            role="critic", seed=seed, images=images,
        ))
        verdict = parse_json_block(response.text)
        return SetCritique(verdict["coherent"], verdict["feedback"]), response
