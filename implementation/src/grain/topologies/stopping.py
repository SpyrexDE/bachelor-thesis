"""Termination condition for Fine's critic loop, exactly the stopping rule from
concept/01: critic accepts, or a round's proxy gain falls below the threshold,
or the hard cap. Kept as its own unit so the rule is visible and testable."""

from dataclasses import dataclass

from grain.agents.messages import SetCritique

HARD_CAP = 5                  # revision rounds; a cost limit, not a tuning knob (concept/01)
PROXY_GAIN_THRESHOLD = 0.02   # placeholder until the pilot sets it (concept/01 open point)


@dataclass(frozen=True)
class StopDecision:
    stop: bool
    reason: str | None  # accepted | converged | cap


def should_stop(critique: SetCritique, round_: int, proxies: dict[int, float]) -> StopDecision:
    if critique.coherent:
        return StopDecision(True, "accepted")
    if round_ >= 1 and proxies[round_] - proxies[round_ - 1] < PROXY_GAIN_THRESHOLD:
        return StopDecision(True, "converged")
    if round_ >= HARD_CAP:
        return StopDecision(True, "cap")
    return StopDecision(False, None)
