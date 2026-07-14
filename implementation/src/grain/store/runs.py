import json
import sqlite3

from grain.store.db import now


def insert_run(conn: sqlite3.Connection, run: dict) -> None:
    conn.execute(
        """INSERT INTO runs (id, brief_id, topology, rep, seed, provider, status, job_id, created_at)
           VALUES (:id, :brief_id, :topology, :rep, :seed, :provider, :status, :job_id, :created_at)""",
        {**run, "created_at": now()},
    )


def set_run_status(conn: sqlite3.Connection, run_id: str, status: str, error: str | None = None) -> None:
    finished = now() if status in ("done", "failed") else None
    conn.execute(
        "UPDATE runs SET status = ?, error = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?",
        (status, error, finished, run_id),
    )


def finish_run(conn: sqlite3.Connection, run_id: str, rounds: int | None,
               stop_reason: str | None, wall_clock_s: float) -> None:
    conn.execute(
        """UPDATE runs SET status = 'done', rounds = ?, stop_reason = ?, wall_clock_s = ?,
           finished_at = ? WHERE id = ?""",
        (rounds, stop_reason, wall_clock_s, now(), run_id),
    )


def get_run(conn: sqlite3.Connection, run_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()


def list_runs(conn: sqlite3.Connection, brief_id: str | None = None,
              topology: str | None = None, status: str | None = None) -> list[sqlite3.Row]:
    query = "SELECT * FROM runs WHERE 1=1"
    args: list = []
    for column, value in (("brief_id", brief_id), ("topology", topology), ("status", status)):
        if value is not None:
            query += f" AND {column} = ?"
            args.append(value)
    query += " ORDER BY created_at DESC, id"
    return conn.execute(query, args).fetchall()


def delete_run(conn: sqlite3.Connection, run_id: str) -> None:
    conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))


def insert_calls(conn: sqlite3.Connection, run_id: str, calls: list[dict]) -> None:
    conn.executemany(
        """INSERT INTO calls (run_id, idx, role, agent, purpose, round, seed, tokens_in,
           tokens_out, duration_s, started_s, ended_s, parents, prompt, output)
           VALUES (:run_id, :idx, :role, :agent, :purpose, :round, :seed, :tokens_in,
           :tokens_out, :duration_s, :started_s, :ended_s, :parents, :prompt, :output)""",
        [{**call, "run_id": run_id, "parents": json.dumps(call["parents"])} for call in calls],
    )


def list_calls(conn: sqlite3.Connection, run_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM calls WHERE run_id = ? ORDER BY idx", (run_id,)
    ).fetchall()


def insert_artifact(conn: sqlite3.Connection, run_id: str, platform: str, round_: int,
                    is_final: bool, image_path: str, caption: str | None) -> None:
    conn.execute(
        """INSERT INTO artifacts (run_id, platform, round, is_final, image_path, caption)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (run_id, platform, round_, int(is_final), image_path, caption),
    )


def mark_final_round(conn: sqlite3.Connection, run_id: str, round_: int) -> None:
    conn.execute("UPDATE artifacts SET is_final = 0 WHERE run_id = ?", (run_id,))
    conn.execute(
        "UPDATE artifacts SET is_final = 1 WHERE run_id = ? AND round = ?", (run_id, round_)
    )


def list_artifacts(conn: sqlite3.Connection, run_id: str, final_only: bool = False) -> list[sqlite3.Row]:
    query = "SELECT * FROM artifacts WHERE run_id = ?"
    if final_only:
        query += " AND is_final = 1"
    return conn.execute(query + " ORDER BY round, platform", (run_id,)).fetchall()


def get_artifact(conn: sqlite3.Connection, run_id: str, platform: str,
                 round_: int | None = None) -> sqlite3.Row | None:
    if round_ is None:
        return conn.execute(
            "SELECT * FROM artifacts WHERE run_id = ? AND platform = ? AND is_final = 1",
            (run_id, platform),
        ).fetchone()
    return conn.execute(
        "SELECT * FROM artifacts WHERE run_id = ? AND platform = ? AND round = ?",
        (run_id, platform, round_),
    ).fetchone()


def upsert_metric(conn: sqlite3.Connection, run_id: str, metric: str, scope: str,
                  value: float, detail: dict) -> None:
    conn.execute(
        """INSERT INTO metrics (run_id, metric, scope, value, detail) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (run_id, metric, scope) DO UPDATE SET value = excluded.value,
           detail = excluded.detail""",
        (run_id, metric, scope, value, json.dumps(detail)),
    )


def list_metrics(conn: sqlite3.Connection, run_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM metrics WHERE run_id = ?", (run_id,)).fetchall()


def metric_value(conn: sqlite3.Connection, run_id: str, metric: str, scope: str = "set") -> float | None:
    row = conn.execute(
        "SELECT value FROM metrics WHERE run_id = ? AND metric = ? AND scope = ?",
        (run_id, metric, scope),
    ).fetchone()
    return row["value"] if row else None
