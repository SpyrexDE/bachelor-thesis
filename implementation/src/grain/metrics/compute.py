"""Runs all five metrics for a finished run and stores them as metric rows.
Judges are called here, after the run: they are measurement, not part of the
system, so their calls never enter the run's trace (concept/03)."""

from pathlib import Path

from grain.domain.brief import Brief
from grain.domain.platforms import platform
from grain.metrics.latency import run_latency
from grain.metrics.set_coherence import score_set
from grain.metrics.spec import check_artifact, compliance_share
from grain.metrics.tax import coordination_tax
from grain.metrics.viescore import score_artifact
from grain.providers.base import Provider
from grain.store import runs as store


def compute_run_metrics(conn, data_dir: Path, provider: Provider, run_id: str,
                        briefs: dict[str, Brief]) -> None:
    run = store.get_run(conn, run_id)
    if run is None:
        raise ValueError(f"unknown run: {run_id}")
    brief = briefs[run["brief_id"]]
    calls = [dict(c) for c in store.list_calls(conn, run_id)]

    tax = coordination_tax(calls)
    store.upsert_metric(conn, run_id, "tax", "set", tax.pop("value"), tax)

    latency = run_latency(calls)
    store.upsert_metric(conn, run_id, "latency", "set", latency.pop("value"), latency)

    final = {row["platform"]: row for row in store.list_artifacts(conn, run_id, final_only=True)}
    all_checks: list[dict] = []
    o_scores: dict[str, float] = {}
    for pid, row in final.items():
        spec = platform(pid)
        image_path = data_dir / row["image_path"]

        checks = check_artifact(brief, spec, image_path)
        all_checks.extend(checks)
        store.upsert_metric(conn, run_id, "spec", pid, compliance_share(checks), {"checks": checks})

        vie = score_artifact(provider, brief, spec, image_path, run["seed"])
        o_scores[pid] = vie["value"]
        store.upsert_metric(conn, run_id, "viescore", pid, vie.pop("value"), vie)

    store.upsert_metric(conn, run_id, "spec", "set", compliance_share(all_checks),
                        {"passed": sum(1 for c in all_checks if c["passed"]), "total": len(all_checks)})
    # Per-set quality: the per-artifact scores averaged over the set (concept/03).
    store.upsert_metric(conn, run_id, "viescore", "set",
                        round(sum(o_scores.values()) / len(o_scores), 4),
                        {"per_artifact": o_scores})

    rounds = sorted({row["round"] for row in store.list_artifacts(conn, run_id)})
    # Fine keeps per-round scores even when the loop stopped without revising:
    # a one-point curve is still a curve (concept/04).
    is_fine = run["stop_reason"] is not None
    for round_ in rounds:
        by_platform = {
            row["platform"]: row
            for row in store.list_artifacts(conn, run_id)
            if row["round"] == round_
        }
        images = {pid: data_dir / row["image_path"] for pid, row in by_platform.items()}
        result = score_set(provider, brief, images, run["seed"],
                           seed_key=f"judge:coherence:{round_}")
        value = result.pop("value")
        if is_fine:
            # The round curve: every intermediate set scored by the official judge
            # after the run ended, so the loop never saw it (concept/04).
            store.upsert_metric(conn, run_id, "coherence", f"round:{round_}", value, result)
        if round_ == rounds[-1]:
            store.upsert_metric(conn, run_id, "coherence", "set", value, result)
