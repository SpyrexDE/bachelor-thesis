"""Latency: end-to-end brief-to-set time, read as the longest path over the
run's call graph so parallel producers count once (concept/03; decisions D4)."""

import json


def run_latency(calls: list[dict]) -> dict:
    if not calls:
        raise ValueError("run has no recorded calls")
    by_idx = {c["idx"]: c for c in calls}
    last = max(calls, key=lambda c: c["ended_s"])

    path = [last["idx"]]
    current = last
    while True:
        parents = json.loads(current["parents"]) if isinstance(current["parents"], str) else current["parents"]
        if not parents:
            break
        current = max((by_idx[p] for p in parents), key=lambda c: c["ended_s"])
        path.append(current["idx"])
    return {"value": last["ended_s"], "critical_path": list(reversed(path))}
