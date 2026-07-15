"""Materialises the human-evaluation plan (concept/03): review sets for every
matrix run, the calibration anchors, the scrambled catch sets, and the A/B pair
list. Set and pair ids are opaque so nothing leaks to raters."""

import hashlib
import json
import sqlite3
from pathlib import Path
from random import Random

from grain.analysis.machine import matrix_cells
from grain.domain.brief import Brief
from grain.domain.platforms import PLATFORMS
from grain.domain.topology import STEPS, Topology
from grain.metrics.set_coherence import score_set
from grain.providers.base import Provider
from grain.store import review as review_store
from grain.store import runs as run_store

REPS = (1, 2, 3)  # 3 reps per (brief, topology): concept/02, test matrix


def opaque_id(prefix: str, seed: int, *parts: object) -> str:
    digest = hashlib.sha256(f"{seed}:{':'.join(str(p) for p in parts)}".encode()).hexdigest()
    return f"{prefix}{digest[:8]}"


def require_complete_matrix(cells: dict, briefs: dict[str, Brief]) -> None:
    missing = [
        f"{brief_id}/{topology.value}/rep{rep}"
        for brief_id in sorted(briefs)
        for topology in Topology
        for rep in REPS
        if (brief_id, topology.value, rep) not in cells
    ]
    if missing:
        raise ValueError(
            f"review plan needs the full matrix; missing {len(missing)} runs: "
            + ", ".join(missing[:6]) + ("..." if len(missing) > 6 else "")
        )


def final_artifacts(conn: sqlite3.Connection, run_id: str) -> dict[str, dict]:
    rows = run_store.list_artifacts(conn, run_id, final_only=True)
    return {row["platform"]: {"image_path": row["image_path"]} for row in rows}


def set_artifacts(conn: sqlite3.Connection, set_row: sqlite3.Row) -> dict[str, dict]:
    composition = json.loads(set_row["composition"])
    result = {}
    for platform_id, source in composition["sources"].items():
        artifacts = final_artifacts(conn, source["run_id"])
        result[platform_id] = artifacts[platform_id]
    return result


def judge_assembled_set(conn: sqlite3.Connection, data_dir: Path, provider: Provider,
                        briefs: dict[str, Brief], brief_id: str,
                        sources: dict[str, dict], seed: int, set_id: str) -> dict:
    images = {}
    for platform_id, source in sources.items():
        artifact = final_artifacts(conn, source["run_id"])[platform_id]
        images[platform_id] = data_dir / artifact["image_path"]
    result = score_set(provider, briefs[brief_id], images, seed,
                       seed_key=f"judge:review-set:{set_id}")
    result["score"] = result.pop("value")
    return result


def generate_plan(conn: sqlite3.Connection, data_dir: Path, provider: Provider,
                  briefs: dict[str, Brief], seed: int, within_count: int = 9) -> dict:
    cells = matrix_cells(conn)
    require_complete_matrix(cells, briefs)
    rng = Random(seed)
    review_store.clear_plan(conn)

    set_ids: dict[tuple[str, str, int], str] = {}
    for (brief_id, topology, rep), run_id in sorted(cells.items()):
        if brief_id not in briefs:
            continue
        set_id = opaque_id("S", seed, "real", run_id)
        set_ids[(brief_id, topology, rep)] = set_id
        review_store.insert_review_set(
            conn, set_id, "real", brief_id, run_id,
            {"sources": {spec: {"run_id": run_id} for spec in final_artifacts(conn, run_id)}},
        )

    # Scrambles: per brief, artifacts from three different runs of that brief,
    # so message and tone should drift (concept/03).
    platforms = tuple(spec.id for spec in PLATFORMS)
    for brief_id in sorted(briefs):
        brief_runs = [run_id for (b, _t, _r), run_id in sorted(cells.items()) if b == brief_id]
        chosen = rng.sample(brief_runs, 3)
        sources = {pid: {"run_id": run_id} for pid, run_id in zip(platforms, chosen)}
        set_id = opaque_id("S", seed, "scramble", brief_id)
        judge = judge_assembled_set(conn, data_dir, provider, briefs, brief_id,
                                    sources, seed, set_id)
        review_store.insert_review_set(conn, set_id, "scramble", brief_id, None,
                                       {"sources": sources, "judge": judge})

    # Anchor 1: deliberately incoherent, mixed across briefs (concept/03).
    brief_ids = sorted(briefs)
    mixed_runs = [
        cells[(brief_id, rng.choice([t.value for t in Topology]), rng.choice(REPS))]
        for brief_id in brief_ids
    ]
    shown_brief = rng.choice(brief_ids)
    sources = {pid: {"run_id": run_id} for pid, run_id in zip(platforms, mixed_runs)}
    incoherent_id = opaque_id("S", seed, "anchor_incoherent")
    judge = judge_assembled_set(conn, data_dir, provider, briefs, shown_brief,
                                sources, seed, incoherent_id)
    review_store.insert_review_set(conn, incoherent_id, "anchor_incoherent", shown_brief,
                                   None, {"sources": sources, "judge": judge})

    # Anchor 2: a strong set, the highest-scored real set by the official judge.
    scored = [
        (run_store.metric_value(conn, run_id, "coherence") or 0.0, cell)
        for cell, run_id in sorted(cells.items())
    ]
    _best_score, best_cell = max(scored)
    best_run = cells[best_cell]
    strong_id = opaque_id("S", seed, "anchor_strong")
    review_store.insert_review_set(
        conn, strong_id, "anchor_strong", best_cell[0], best_run,
        {"sources": {spec: {"run_id": best_run} for spec in final_artifacts(conn, best_run)}},
    )

    # Between-topology pairs: the three adjacent steps, same brief, same rep (concept/03).
    between = 0
    for brief_id in brief_ids:
        for earlier, later in STEPS:
            for rep in REPS:
                pair_id = opaque_id("P", seed, "between", brief_id, earlier, later, rep)
                review_store.insert_ab_pair(
                    conn, pair_id, brief_id, "between",
                    f"{earlier.value}-{later.value}", rep,
                    set_ids[(brief_id, earlier.value, rep)],
                    set_ids[(brief_id, later.value, rep)],
                )
                between += 1

    # Within-topology control pairs, sampled to the rater budget (concept/03).
    candidates = [
        (brief_id, topology.value, r1, r2)
        for brief_id in brief_ids
        for topology in Topology
        for r1, r2 in ((1, 2), (1, 3), (2, 3))
    ]
    within = rng.sample(candidates, min(within_count, len(candidates)))
    for brief_id, topology, r1, r2 in within:
        pair_id = opaque_id("P", seed, "within", brief_id, topology, r1, r2)
        review_store.insert_ab_pair(
            conn, pair_id, brief_id, "within", None, None,
            set_ids[(brief_id, topology, r1)], set_ids[(brief_id, topology, r2)],
        )

    params = {"within_count": len(within), "between_count": between}
    review_store.save_plan(conn, seed, params)
    return {"seed": seed, **params, "sets": len(set_ids) + len(brief_ids) + 2}
