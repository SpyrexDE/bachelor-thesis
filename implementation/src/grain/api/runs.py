import json
import os
import shutil
import uuid
from sqlite3 import Connection

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from grain.api.deps import get_conn
from grain.domain.topology import Topology
from grain.harness.seeds import run_seed
from grain.metrics.compute import compute_run_metrics
from grain.store import jobs as job_store
from grain.store import runs as run_store

router = APIRouter(prefix="/api")

SUMMARY_METRICS = ("coherence", "viescore", "tax", "latency", "spec")


class Cell(BaseModel):
    brief: str
    topology: str
    rep: int


class StartRuns(BaseModel):
    # Either explicit cells, or the cross product of briefs x topologies x reps.
    cells: list[Cell] | None = None
    briefs: list[str] = Field(default_factory=list)
    topologies: list[str] = Field(default_factory=list)
    reps: list[int] = Field(default=[1, 2, 3])
    fresh_seeds: bool = False  # False: reproducible matrix seeds (concept/02)


class Rerun(BaseModel):
    reuse_seed: bool = True


def random_seed() -> int:
    return int.from_bytes(os.urandom(4), "big")


def run_summary(conn: Connection, row) -> dict:
    metrics = {
        name: run_store.metric_value(conn, row["id"], name) for name in SUMMARY_METRICS
    }
    final = conn.execute(
        "SELECT round FROM artifacts WHERE run_id = ? AND is_final = 1 LIMIT 1", (row["id"],)
    ).fetchone()
    return {
        "id": row["id"], "brief": row["brief_id"], "topology": row["topology"],
        "rep": row["rep"], "seed": row["seed"], "status": row["status"],
        "error": row["error"], "rounds": row["rounds"], "stop_reason": row["stop_reason"],
        "created_at": row["created_at"], "finished_at": row["finished_at"],
        "wall_clock_s": row["wall_clock_s"],  # harness time; latency is the modeled metric (D4)
        "final_round": final["round"] if final else None,  # lets the UI address artifact images
        "metrics": metrics,
    }


@router.get("/briefs")
def list_briefs(request: Request) -> list[dict]:
    briefs = request.app.state.briefs
    return [
        {
            "id": b.id, "brand": b.brand, "product": b.product, "text": b.as_text(),
            "required_claims": list(b.mandatories.required_claims),
            "prohibited_wording": list(b.mandatories.prohibited_wording),
        }
        for b in briefs.values()
    ]


@router.get("/matrix")
def matrix(request: Request, conn: Connection = Depends(get_conn)) -> dict:
    briefs = sorted(request.app.state.briefs)
    finals = {
        row["run_id"]: row["round"]
        for row in conn.execute(
            "SELECT run_id, MAX(round) AS round FROM artifacts WHERE is_final = 1 GROUP BY run_id"
        ).fetchall()
    }
    cells: dict[str, dict] = {}
    for row in conn.execute(
        "SELECT * FROM runs ORDER BY created_at, rowid"
    ).fetchall():
        key = f"{row['brief_id']}|{row['topology']}|{row['rep']}"
        cells[key] = {
            "run_id": row["id"], "status": row["status"],
            "coherence": run_store.metric_value(conn, row["id"], "coherence"),
            "final_round": finals.get(row["id"]),
        }
    return {
        "briefs": briefs,
        "topologies": [t.value for t in Topology],
        "reps": [1, 2, 3],
        "cells": cells,
        "active_jobs": [
            {**dict(j), "progress": json.loads(j["progress"])}
            for j in job_store.list_jobs(conn, active_only=True)
        ],
    }


@router.post("/runs", status_code=202)
def start_runs(body: StartRuns, request: Request, conn: Connection = Depends(get_conn)) -> dict:
    briefs = request.app.state.briefs
    if body.cells is not None:
        cells = [(c.brief, c.topology, c.rep) for c in body.cells]
    else:
        cells = [(b, t, r) for b in body.briefs for t in body.topologies for r in body.reps]
    valid = all(
        brief in briefs and topology in [t.value for t in Topology] and rep in (1, 2, 3)
        for brief, topology, rep in cells
    )
    if not cells or not valid:
        raise HTTPException(400, "invalid selection of briefs, topologies, or reps")

    specs = []
    for brief_id, topology, rep in cells:
        seed = random_seed() if body.fresh_seeds else run_seed(brief_id, topology, rep)
        specs.append({
            "run_id": f"{brief_id}-{topology}-r{rep}-{uuid.uuid4().hex[:4]}",
            "brief_id": brief_id, "topology": topology, "rep": rep, "seed": seed,
        })
    return enqueue(request, conn, specs)


def enqueue(request: Request, conn: Connection, specs: list[dict]) -> dict:
    job_id = uuid.uuid4().hex[:12]
    job_store.insert_job(conn, job_id, "runs", {"runs": specs}, total=len(specs))
    for spec in specs:
        run_store.insert_run(conn, {
            **spec, "id": spec["run_id"], "provider": request.app.state.provider.name,
            "status": "queued", "job_id": job_id,
        })
    conn.commit()
    request.app.state.worker.submit(job_id)
    return {"job_id": job_id, "runs": [s["run_id"] for s in specs]}


@router.get("/runs")
def list_runs(brief: str | None = None, topology: str | None = None,
              status: str | None = None, conn: Connection = Depends(get_conn)) -> list[dict]:
    rows = run_store.list_runs(conn, brief, topology, status)
    return [run_summary(conn, row) for row in rows]


@router.get("/runs/{run_id}")
def run_detail(run_id: str, conn: Connection = Depends(get_conn)) -> dict:
    row = run_store.get_run(conn, run_id)
    if row is None:
        raise HTTPException(404, "run not found")
    artifacts = [dict(a) for a in run_store.list_artifacts(conn, run_id)]
    metric_details = [
        {**dict(m), "detail": json.loads(m["detail"])}
        for m in run_store.list_metrics(conn, run_id)
    ]
    calls = [
        {**dict(c), "parents": json.loads(c["parents"])}
        for c in run_store.list_calls(conn, run_id)
    ]
    return {**run_summary(conn, row), "artifacts": artifacts,
            "metric_details": metric_details, "calls": calls}


@router.delete("/runs/{run_id}")
def delete_run(run_id: str, request: Request, conn: Connection = Depends(get_conn)) -> dict:
    row = run_store.get_run(conn, run_id)
    if row is None:
        raise HTTPException(404, "run not found")
    if row["status"] == "running":
        raise HTTPException(409, "run is executing; wait for it to finish")
    referenced = conn.execute(
        "SELECT 1 FROM review_sets WHERE composition LIKE ?", (f"%{run_id}%",)
    ).fetchone()
    if referenced:
        raise HTTPException(409, "run is part of the review plan; delete the plan first")

    run_store.delete_run(conn, run_id)
    conn.commit()
    run_dir = request.app.state.settings.data_dir / "runs" / run_id
    if run_dir.exists():
        shutil.rmtree(run_dir)
    return {"deleted": run_id}


@router.post("/runs/{run_id}/rerun", status_code=202)
def rerun(run_id: str, body: Rerun, request: Request,
          conn: Connection = Depends(get_conn)) -> dict:
    row = run_store.get_run(conn, run_id)
    if row is None:
        raise HTTPException(404, "run not found")
    spec = {
        "run_id": f"{row['brief_id']}-{row['topology']}-r{row['rep']}-{uuid.uuid4().hex[:4]}",
        "brief_id": row["brief_id"], "topology": row["topology"], "rep": row["rep"],
        "seed": row["seed"] if body.reuse_seed else random_seed(),
    }
    return enqueue(request, conn, [spec])


@router.post("/runs/{run_id}/recompute")
def recompute(run_id: str, request: Request, conn: Connection = Depends(get_conn)) -> dict:
    row = run_store.get_run(conn, run_id)
    if row is None:
        raise HTTPException(404, "run not found")
    if row["status"] != "done":
        raise HTTPException(409, "metrics exist only for finished runs")
    compute_run_metrics(conn, request.app.state.settings.data_dir,
                        request.app.state.provider, run_id, request.app.state.briefs)
    return {"recomputed": run_id}


@router.get("/artifacts/{run_id}/{platform}/{round_}")
def artifact_image(run_id: str, platform: str, round_: int, request: Request,
                   conn: Connection = Depends(get_conn)) -> FileResponse:
    row = run_store.get_artifact(conn, run_id, platform, round_)
    if row is None:
        raise HTTPException(404, "artifact not found")
    return FileResponse(request.app.state.settings.data_dir / row["image_path"],
                        media_type="image/png")


@router.get("/jobs")
def jobs(active: bool = False, conn: Connection = Depends(get_conn)) -> list[dict]:
    rows = job_store.list_jobs(conn, active_only=active)
    return [
        {**dict(row), "params": json.loads(row["params"]), "progress": json.loads(row["progress"])}
        for row in rows
    ]
