import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = Path(__file__).with_name("schema.sql")


def connect(data_dir: Path) -> sqlite3.Connection:
    data_dir.mkdir(parents=True, exist_ok=True)
    # check_same_thread=False: FastAPI runs a sync request's dependency, handler,
    # and teardown on varying threadpool threads. Every request opens its own
    # connection and uses it strictly sequentially, which is the safe case.
    conn = sqlite3.connect(data_dir / "grain.db", timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(data_dir: Path) -> None:
    with closing(connect(data_dir)) as conn:
        conn.executescript(SCHEMA.read_text())
        # Migration-lite for databases created before a column existed.
        session_columns = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
        if "pilot" not in session_columns:
            conn.execute("ALTER TABLE sessions ADD COLUMN pilot INTEGER NOT NULL DEFAULT 0")
        call_columns = {row[1] for row in conn.execute("PRAGMA table_info(calls)")}
        if "prompt" not in call_columns:
            conn.execute("ALTER TABLE calls ADD COLUMN prompt TEXT")
        if "output" not in call_columns:
            conn.execute("ALTER TABLE calls ADD COLUMN output TEXT")
        conn.commit()


def now() -> str:
    # Microseconds: "latest run per slot" must stay unambiguous when a batch
    # inserts several rows within the same second.
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")
