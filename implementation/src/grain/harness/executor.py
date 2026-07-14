"""Executes one run: (brief, topology) with a seed, producing the artifact set
plus telemetry (concept/02, Run)."""

import time
from dataclasses import dataclass
from pathlib import Path

from grain.domain.brief import Brief
from grain.domain.topology import Topology
from grain.harness.trace import Trace
from grain.providers.base import Provider
from grain.topologies import coarse, fine, independent, monolithic
from grain.topologies.execution import Execution, Outcome

RUNNERS = {
    Topology.MONOLITHIC: monolithic.run,
    Topology.INDEPENDENT: independent.run,
    Topology.COARSE: coarse.run,
    Topology.FINE: fine.run,
}


@dataclass(frozen=True)
class RunSpec:
    run_id: str
    brief: Brief
    topology: Topology
    rep: int
    seed: int


@dataclass(frozen=True)
class RunResult:
    trace: Trace
    outcome: Outcome
    wall_clock_s: float


def execute_run(spec: RunSpec, provider: Provider, data_dir: Path) -> RunResult:
    started = time.monotonic()
    execution = Execution(
        brief=spec.brief,
        provider=provider,
        trace=Trace(),
        run_seed=spec.seed,
        run_dir=data_dir / "runs" / spec.run_id,
    )
    outcome = RUNNERS[spec.topology](execution)
    return RunResult(
        trace=execution.trace,
        outcome=outcome,
        wall_clock_s=round(time.monotonic() - started, 3),
    )
