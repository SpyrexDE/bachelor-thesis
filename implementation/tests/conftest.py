import shutil
import uuid

import pytest

from grain.config import IMPLEMENTATION_ROOT, Settings
from grain.domain.brief import load_briefs
from grain.domain.topology import Topology
from grain.harness.jobs import execute_and_record
from grain.harness.seeds import run_seed
from grain.providers.registry import get_provider
from grain.store import runs as run_store
from grain.store.db import connect, init_db


def tesseract_available() -> bool:
    return shutil.which("tesseract") is not None

requires_tesseract = pytest.mark.skipif(
    not tesseract_available(), reason="tesseract binary not installed"
)


@pytest.fixture(scope="session")
def briefs():
    return load_briefs(IMPLEMENTATION_ROOT / "briefs")


@pytest.fixture(scope="session")
def provider():
    return get_provider("mock")


def record_run(conn, data_dir, provider, briefs, brief_id, topology, rep, seed=None) -> str:
    run_id = f"{brief_id}-{topology}-r{rep}-{uuid.uuid4().hex[:4]}"
    seed = seed if seed is not None else run_seed(brief_id, topology, rep)
    raw = {"run_id": run_id, "brief_id": brief_id, "topology": topology, "rep": rep, "seed": seed}
    run_store.insert_run(conn, {**raw, "id": run_id, "provider": "mock",
                                "status": "queued", "job_id": None})
    execute_and_record(conn, data_dir, provider, briefs, raw)
    conn.commit()
    return run_id


@pytest.fixture()
def workspace(tmp_path, provider, briefs):
    """Fresh data dir plus an open connection; metrics need tesseract."""
    data_dir = tmp_path / "data"
    init_db(data_dir)
    conn = connect(data_dir)
    yield conn, data_dir
    conn.close()


@pytest.fixture(scope="session")
def matrix(tmp_path_factory, provider, briefs):
    """The full 3x4x3 matrix, executed once per test session (concept/02)."""
    if not tesseract_available():
        pytest.skip("full matrix needs tesseract for spec compliance")
    data_dir = tmp_path_factory.mktemp("matrix-data")
    init_db(data_dir)
    conn = connect(data_dir)
    for brief_id in briefs:
        for topology in Topology:
            for rep in (1, 2, 3):
                record_run(conn, data_dir, provider, briefs, brief_id, topology.value, rep)
    yield conn, data_dir
    conn.close()


@pytest.fixture()
def app_client(tmp_path, briefs):
    from fastapi.testclient import TestClient

    from grain.api.app import create_app

    settings = Settings(
        data_dir=tmp_path / "data",
        briefs_dir=IMPLEMENTATION_ROOT / "briefs",
        provider="mock",
        admin_token=None,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        yield client
