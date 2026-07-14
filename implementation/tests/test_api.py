"""API surface: jobs, run lifecycle, rater flow, blindness."""

import re
import time

from tests.conftest import requires_tesseract


def wait_for_job(client, job_id, timeout_s=120):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        job = next(j for j in client.get("/api/jobs").json() if j["id"] == job_id)
        if job["status"] in ("done", "failed"):
            return job
        time.sleep(0.2)
    raise AssertionError("job did not finish in time")


def test_health(app_client):
    body = app_client.get("/health").json()
    assert body == {"status": "ok", "provider": "mock"}


def test_briefs_exposed(app_client):
    briefs = app_client.get("/api/briefs").json()
    assert {b["id"] for b in briefs} == {"persil", "schwarzkopf", "loctite"}
    assert all(b["required_claims"] for b in briefs)


@requires_tesseract
def test_run_lifecycle(app_client):
    started = app_client.post("/api/runs", json={
        "briefs": ["persil"], "topologies": ["coarse"], "reps": [1],
    })
    assert started.status_code == 202
    job = wait_for_job(app_client, started.json()["job_id"])
    assert job["status"] == "done" and job["progress"]["failed"] == 0

    run_id = started.json()["runs"][0]
    detail = app_client.get(f"/api/runs/{run_id}").json()
    assert detail["status"] == "done"
    assert {m["metric"] for m in detail["metric_details"]} >= {
        "tax", "latency", "spec", "viescore", "coherence",
    }
    assert any(c["purpose"] == "coordination" for c in detail["calls"])

    image = app_client.get(f"/api/artifacts/{run_id}/instagram/0")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"

    rerun = app_client.post(f"/api/runs/{run_id}/rerun", json={"reuse_seed": True})
    job = wait_for_job(app_client, rerun.json()["job_id"])
    assert job["status"] == "done"
    new_id = rerun.json()["runs"][0]
    old = app_client.get(f"/api/runs/{run_id}").json()
    new = app_client.get(f"/api/runs/{new_id}").json()
    assert old["seed"] == new["seed"]
    assert old["metrics"]["coherence"] == new["metrics"]["coherence"]  # reproduced

    deleted = app_client.delete(f"/api/runs/{run_id}")
    assert deleted.status_code == 200
    assert app_client.get(f"/api/runs/{run_id}").status_code == 404


def test_invalid_selection_rejected(app_client):
    response = app_client.post("/api/runs", json={
        "briefs": ["persil"], "topologies": ["waterfall"], "reps": [1],
    })
    assert response.status_code == 400


def test_plan_requires_full_matrix(app_client):
    response = app_client.post("/api/review/plan", json={})
    assert response.status_code == 409
    assert "missing" in response.json()["detail"]


def test_analysis_endpoints_survive_an_empty_database(app_client):
    machine = app_client.get("/api/analysis/machine").json()
    assert machine["cells"] == 0
    pareto = app_client.get("/api/analysis/pareto").json()
    assert pareto["positions"] == {}
    assert all(not checks for checks in pareto["spec_errors"].values())
    rounds = app_client.get("/api/analysis/rounds").json()
    assert rounds["curves"] == []


def test_orphaned_work_is_swept_on_startup(tmp_path, briefs):
    from fastapi.testclient import TestClient

    from grain.api.app import create_app
    from grain.config import IMPLEMENTATION_ROOT, Settings
    from grain.store import runs as run_store
    from grain.store.db import connect, init_db

    settings = Settings(data_dir=tmp_path / "data", briefs_dir=IMPLEMENTATION_ROOT / "briefs",
                        provider="mock", admin_token=None)
    init_db(settings.data_dir)
    with connect(settings.data_dir) as conn:
        run_store.insert_run(conn, {
            "id": "persil-coarse-r1-dead", "brief_id": "persil", "topology": "coarse",
            "rep": 1, "seed": 7, "provider": "mock", "status": "running", "job_id": "j1",
        })
        conn.commit()

    with TestClient(create_app(settings)) as client:
        run = client.get("/api/runs/persil-coarse-r1-dead").json()
        assert run["status"] == "failed"
        assert "orphaned" in run["error"]
        # No longer blocked from deletion (the process that ran it is gone).
        assert client.delete("/api/runs/persil-coarse-r1-dead").status_code == 200


def test_admin_gate_blocks_console_but_not_raters(tmp_path, briefs):
    from fastapi.testclient import TestClient

    from grain.api.app import create_app
    from grain.config import IMPLEMENTATION_ROOT, Settings

    settings = Settings(
        data_dir=tmp_path / "data",
        briefs_dir=IMPLEMENTATION_ROOT / "briefs",
        provider="mock",
        admin_token="s3cret",
    )
    with TestClient(create_app(settings)) as client:
        # Researcher surface requires the token (blinding, concept/03; D13)...
        assert client.get("/api/runs").status_code == 401
        assert client.get("/api/review/sets").status_code == 401
        assert client.get("/api/runs", headers={"X-Admin-Token": "s3cret"}).status_code == 200
        # ...the cookie path serves <img> tags, which cannot send headers...
        client.cookies.set("grain_admin", "s3cret")
        assert client.get("/api/runs").status_code == 200
        client.cookies.clear()
        # ...while raters and the health check stay open.
        assert client.get("/health").status_code == 200
        assert client.get("/api/review/session/NOCODE").status_code == 404


@requires_tesseract
def test_rater_flow_stays_blind(app_client):
    started = app_client.post("/api/runs", json={
        "briefs": ["persil", "schwarzkopf", "loctite"],
        "topologies": ["monolithic", "independent", "coarse", "fine"],
        "reps": [1, 2, 3],
    })
    job = wait_for_job(app_client, started.json()["job_id"], timeout_s=600)
    assert job["status"] == "done" and job["progress"]["failed"] == 0

    plan = app_client.post("/api/review/plan", json={"seed": 99})
    assert plan.status_code == 200

    session = app_client.post("/api/review/sessions", json={
        "label": "rater-one", "ab": True, "rubric": True,
    }).json()
    code = session["code"]

    state = app_client.get(f"/api/review/session/{code}").json()
    assert state["stage"] == "ab"
    current = state["current"]
    # Blindness: nothing in the rater payload names topologies, run ids, or set
    # kinds. The brief text is excluded — raters see it by design, and its plain
    # English may contain words like "independent" (Persil's lab-test line).
    scrubbed = {**current, "brief": current["brief"]["id"]}
    flat = str(scrubbed)
    for forbidden in ("monolithic", "independent", "coarse", "fine"):
        assert not re.search(rf"\b{forbidden}\b", flat), f"rater payload leaks {forbidden!r}"
    for forbidden in ("-r1-", "-r2-", "-r3-", "scramble", "anchor"):
        assert forbidden not in flat, f"rater payload leaks {forbidden!r}"
    assert current["left"]["artifacts"][0]["image_url"].startswith("/api/review/session/")

    vote = app_client.post(f"/api/review/session/{code}/vote", json={
        "pair_id": current["pair_id"],
        "chosen_set": current["left"]["set_id"],
        "seconds": 4.2,
    })
    assert vote.status_code == 200

    image_url = current["left"]["artifacts"][0]["image_url"]
    assert app_client.get(image_url).status_code == 200

    results = app_client.get("/api/review/results").json()
    total_votes = sum(
        sum(p["votes"].values()) for p in results["ab"]["pairs"].values()
    )
    assert total_votes == 1
