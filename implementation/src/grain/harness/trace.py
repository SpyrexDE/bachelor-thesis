"""Run telemetry: one record per provider call, scheduled on a virtual timeline.

A call starts when its parents have finished (assuming enough parallel API
capacity), so the recorded timeline reflects the topology's true structure:
Independent's producers overlap, Fine's rounds chain. Latency is read off this
timeline as the longest path (docs/decisions.md D4).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Call:
    idx: int
    role: str            # orchestrator | producer | critic | image
    agent: str
    purpose: str         # coordination | production (concept/03, coordination tax)
    round: int
    seed: int
    tokens_in: int
    tokens_out: int
    duration_s: float
    started_s: float
    ended_s: float
    parents: tuple[int, ...]
    prompt: str | None = None   # what the agent was told (drill-down)
    output: str | None = None   # what it returned (chat: raw text; image: None)


class Trace:
    def __init__(self) -> None:
        self.calls: list[Call] = []

    def record(self, *, role: str, agent: str, purpose: str, round_: int, seed: int,
               tokens_in: int, tokens_out: int, duration_s: float,
               parents: tuple[int, ...] = (),
               prompt: str | None = None, output: str | None = None) -> int:
        for parent in parents:
            if parent >= len(self.calls):
                raise ValueError(f"parent call {parent} does not exist yet")
        started = max((self.calls[p].ended_s for p in parents), default=0.0)
        call = Call(
            idx=len(self.calls), role=role, agent=agent, purpose=purpose,
            round=round_, seed=seed, tokens_in=tokens_in, tokens_out=tokens_out,
            duration_s=duration_s, started_s=round(started, 2),
            ended_s=round(started + duration_s, 2), parents=parents,
            prompt=prompt, output=output,
        )
        self.calls.append(call)
        return call.idx

    def as_rows(self) -> list[dict]:
        return [
            {
                "idx": c.idx, "role": c.role, "agent": c.agent, "purpose": c.purpose,
                "round": c.round, "seed": c.seed, "tokens_in": c.tokens_in,
                "tokens_out": c.tokens_out, "duration_s": c.duration_s,
                "started_s": c.started_s, "ended_s": c.ended_s, "parents": list(c.parents),
                "prompt": c.prompt, "output": c.output,
            }
            for c in self.calls
        ]
