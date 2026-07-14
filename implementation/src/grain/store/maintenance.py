"""One-off, self-healing data fixes that run at startup.

The trace gained prompt/output columns after the demo dataset was built. Runs
are seed-deterministic, so re-executing a finished run in a throwaway data dir
reproduces its exact call sequence; we copy the captured payloads onto the
existing call rows by index. Run ids and the review plan stay untouched.
"""

import tempfile
from pathlib import Path

from grain.domain.brief import Brief
from grain.domain.topology import Topology
from grain.harness.executor import RunSpec, execute_run
from grain.providers.base import Provider


def backfill_call_payloads(conn, data_dir: Path, provider: Provider,
                           briefs: dict[str, Brief]) -> int:
    """Fill prompt/output on finished runs whose call rows predate the columns.
    Returns the number of runs backfilled."""
    pending = conn.execute(
        """SELECT r.* FROM runs r
           WHERE r.status = 'done'
             AND EXISTS (SELECT 1 FROM calls c WHERE c.run_id = r.id AND c.prompt IS NULL)"""
    ).fetchall()
    if not pending:
        return 0

    filled = 0
    with tempfile.TemporaryDirectory(prefix="grain-backfill-") as tmp:
        tmp_dir = Path(tmp)
        for row in pending:
            if row["brief_id"] not in briefs:
                continue
            spec = RunSpec(
                run_id=row["id"], brief=briefs[row["brief_id"]],
                topology=Topology(row["topology"]), rep=row["rep"], seed=row["seed"],
            )
            try:
                result = execute_run(spec, provider, tmp_dir)
            except Exception:
                continue  # a run that no longer reproduces is left as-is, not fatal
            for call in result.trace.as_rows():
                conn.execute(
                    "UPDATE calls SET prompt = ?, output = ? WHERE run_id = ? AND idx = ?",
                    (call["prompt"], call["output"], row["id"], call["idx"]),
                )
            filled += 1
    conn.commit()
    return filled
