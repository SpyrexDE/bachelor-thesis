import json
import sqlite3

from grain.store.db import now


def insert_job(conn: sqlite3.Connection, job_id: str, kind: str, params: dict, total: int) -> None:
    timestamp = now()
    conn.execute(
        """INSERT INTO jobs (id, kind, params, status, progress, created_at, updated_at)
           VALUES (?, ?, ?, 'queued', ?, ?, ?)""",
        (job_id, kind, json.dumps(params), json.dumps({"done": 0, "total": total, "current": None}),
         timestamp, timestamp),
    )


def update_job(conn: sqlite3.Connection, job_id: str, status: str | None = None,
               progress: dict | None = None, error: str | None = None) -> None:
    if status is not None:
        conn.execute("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?", (status, now(), job_id))
    if progress is not None:
        conn.execute("UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?",
                     (json.dumps(progress), now(), job_id))
    if error is not None:
        conn.execute("UPDATE jobs SET error = ?, updated_at = ? WHERE id = ?", (error, now(), job_id))


def get_job(conn: sqlite3.Connection, job_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()


def list_jobs(conn: sqlite3.Connection, active_only: bool = False) -> list[sqlite3.Row]:
    query = "SELECT * FROM jobs"
    if active_only:
        query += " WHERE status IN ('queued', 'running')"
    return conn.execute(query + " ORDER BY created_at DESC").fetchall()
