"""Background execution: one worker thread, job and run rows as the interface
the UI polls (docs/decisions.md D7)."""

import json
import queue
import threading
import traceback
from contextlib import closing
from pathlib import Path

from grain.config import Settings
from grain.domain.brief import Brief
from grain.domain.topology import Topology
from grain.harness.executor import RunResult, RunSpec, execute_run
from grain.metrics.compute import compute_run_metrics
from grain.providers.base import Provider
from grain.store import jobs as job_store
from grain.store import runs as run_store
from grain.store.db import connect


def sweep_orphaned_work(conn) -> None:
    """The worker queue lives in memory: any run or job still queued/running at
    process start belonged to a dead process and can never finish. Mark it
    failed so the console stays operable (docs/architecture.md, execution)."""
    for table in ("runs", "jobs"):
        conn.execute(
            f"UPDATE {table} SET status = 'failed', error = 'orphaned by restart' "
            "WHERE status IN ('queued', 'running')"
        )
    conn.commit()


def execute_and_record(conn, data_dir: Path, provider: Provider,
                       briefs: dict[str, Brief], raw: dict) -> None:
    """One run, start to finish: execute, persist trace and artifacts, compute
    metrics. The worker calls this per run; tests call it directly."""
    run_id = raw["run_id"]
    run_store.set_run_status(conn, run_id, "running")
    conn.commit()

    spec = RunSpec(
        run_id=run_id,
        brief=briefs[raw["brief_id"]],
        topology=Topology(raw["topology"]),
        rep=raw["rep"],
        seed=raw["seed"],
    )
    result = execute_run(spec, provider, data_dir)
    _persist(conn, data_dir, run_id, result)
    compute_run_metrics(conn, data_dir, provider, run_id, briefs)


def _persist(conn, data_dir: Path, run_id: str, result: RunResult) -> None:
    run_store.insert_calls(conn, run_id, result.trace.as_rows())

    outcome = result.outcome
    for round_, drafts in sorted(outcome.sets_by_round.items()):
        for pid, draft in drafts.items():
            run_store.insert_artifact(
                conn, run_id, pid, round_,
                is_final=False,
                image_path=draft.image_path.relative_to(data_dir).as_posix(),
                caption=draft.caption,
            )
    run_store.mark_final_round(conn, run_id, outcome.final_round)

    for round_, value in outcome.proxy_by_round.items():
        run_store.upsert_metric(conn, run_id, "proxy", f"round:{round_}", value,
                                {"source": "in-loop stopping proxy"})

    is_fine = outcome.stop_reason is not None
    run_store.finish_run(
        conn, run_id,
        rounds=outcome.final_round if is_fine else None,
        stop_reason=outcome.stop_reason,
        wall_clock_s=result.wall_clock_s,
    )


class Worker:
    def __init__(self, settings: Settings, provider: Provider, briefs: dict[str, Brief]):
        self.settings = settings
        self.provider = provider
        self.briefs = briefs
        self.queue: queue.Queue[str] = queue.Queue()
        self.thread = threading.Thread(target=self._loop, daemon=True, name="grain-worker")
        self.thread.start()

    def submit(self, job_id: str) -> None:
        self.queue.put(job_id)

    def _loop(self) -> None:
        while True:
            job_id = self.queue.get()
            try:
                self._process(job_id)
            except Exception:
                with closing(connect(self.settings.data_dir)) as conn:
                    job_store.update_job(conn, job_id, status="failed",
                                         error=traceback.format_exc(limit=5))
                    conn.commit()

    def _process(self, job_id: str) -> None:
        conn = connect(self.settings.data_dir)
        try:
            job = job_store.get_job(conn, job_id)
            specs = json.loads(job["params"])["runs"]
            job_store.update_job(conn, job_id, status="running")
            conn.commit()

            failures = 0
            for done, raw in enumerate(specs):
                job_store.update_job(conn, job_id, progress={
                    "done": done, "total": len(specs), "current": raw["run_id"],
                })
                conn.commit()
                try:
                    execute_and_record(conn, self.settings.data_dir, self.provider,
                                       self.briefs, raw)
                except Exception:
                    failures += 1
                    run_store.set_run_status(conn, raw["run_id"], "failed",
                                             error=traceback.format_exc(limit=5))
                conn.commit()

            job_store.update_job(conn, job_id, status="done", progress={
                "done": len(specs), "total": len(specs), "current": None,
                "failed": failures,
            })
            conn.commit()
        finally:
            conn.close()
