"""Shared wiring pieces: the execution context, telemetry recording around
agent calls, and artifact materialization (image call plus file). Agents stay
free of trace and seed concerns; this layer owns them."""

from dataclasses import dataclass, field
from pathlib import Path

from grain.agents.messages import ArtifactPlan, SharedConcept
from grain.agents.roles import ProducerAgent
from grain.domain.brief import Brief
from grain.domain.platforms import PlatformSpec
from grain.harness.seeds import call_seed
from grain.harness.trace import Trace
from grain.providers.base import ChatResponse, ImageRequest, Provider


@dataclass
class Execution:
    brief: Brief
    provider: Provider
    trace: Trace
    run_seed: int
    run_dir: Path


@dataclass(frozen=True)
class Draft:
    platform: str
    image_path: Path
    caption: str | None
    producer_idx: int
    image_idx: int


def record_chat(execution: Execution, response: ChatResponse, *, role: str, agent: str,
                purpose: str, round_: int, seed: int, parents: tuple[int, ...]) -> int:
    return execution.trace.record(
        role=role, agent=agent, purpose=purpose, round_=round_, seed=seed,
        tokens_in=response.tokens_in, tokens_out=response.tokens_out,
        duration_s=response.duration_s, parents=parents,
        prompt=response.prompt, output=response.text,
    )


def materialize(execution: Execution, spec: PlatformSpec, plan: ArtifactPlan,
                round_: int, producer_idx: int) -> Draft:
    seed = call_seed(execution.run_seed, f"image:{spec.id}:{round_}")
    response = execution.provider.image(ImageRequest(
        prompt=plan.image_prompt, width=spec.width, height=spec.height, seed=seed,
    ))
    image_idx = execution.trace.record(
        role="image", agent=f"image:{spec.id}", purpose="production", round_=round_,
        seed=seed, tokens_in=response.tokens_in, tokens_out=0,
        duration_s=response.duration_s, parents=(producer_idx,),
        prompt=plan.image_prompt, output=None,
    )
    path = execution.run_dir / "rounds" / str(round_) / f"{spec.id}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.png)
    return Draft(
        platform=spec.id, image_path=path, caption=plan.caption,
        producer_idx=producer_idx, image_idx=image_idx,
    )


def produce_artifact(execution: Execution, spec: PlatformSpec, *,
                     concept: SharedConcept | None = None, feedback: str | None = None,
                     round_: int = 0, parents: tuple[int, ...] = ()) -> Draft:
    seed = call_seed(execution.run_seed, f"producer:{spec.id}:{round_}")
    plan, response = ProducerAgent(execution.provider, spec).produce(
        execution.brief, seed, concept=concept, feedback=feedback,
    )
    producer_idx = record_chat(
        execution, response, role="producer", agent=f"producer:{spec.id}",
        purpose="production", round_=round_, seed=seed, parents=parents,
    )
    return materialize(execution, spec, plan, round_, producer_idx)


@dataclass(frozen=True)
class Outcome:
    # sets_by_round[r] is the full set as it stood after round r; round 0 is the
    # initial production, later rounds exist only in Fine.
    sets_by_round: dict[int, dict[str, Draft]]
    final_round: int
    stop_reason: str | None = None
    proxy_by_round: dict[int, float] = field(default_factory=dict)
