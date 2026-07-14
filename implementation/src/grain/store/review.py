import json
import sqlite3

from grain.store.db import now


def plan_exists(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM review_plan").fetchone() is not None


def save_plan(conn: sqlite3.Connection, seed: int, params: dict) -> None:
    conn.execute(
        "INSERT INTO review_plan (id, seed, params, created_at) VALUES (1, ?, ?, ?)",
        (seed, json.dumps(params), now()),
    )


def get_plan(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM review_plan").fetchone()


def clear_plan(conn: sqlite3.Connection) -> None:
    # Order respects foreign keys; votes and ratings die with the plan.
    for table in ("rubric_ratings", "ab_votes", "sessions", "ab_pairs", "review_sets", "review_plan"):
        conn.execute(f"DELETE FROM {table}")


def insert_review_set(conn: sqlite3.Connection, set_id: str, kind: str, brief_id: str,
                      run_id: str | None, composition: dict) -> None:
    conn.execute(
        """INSERT INTO review_sets (id, kind, brief_id, run_id, composition, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (set_id, kind, brief_id, run_id, json.dumps(composition), now()),
    )


def list_review_sets(conn: sqlite3.Connection, kind: str | None = None) -> list[sqlite3.Row]:
    if kind is None:
        return conn.execute("SELECT * FROM review_sets ORDER BY id").fetchall()
    return conn.execute("SELECT * FROM review_sets WHERE kind = ? ORDER BY id", (kind,)).fetchall()


def get_review_set(conn: sqlite3.Connection, set_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM review_sets WHERE id = ?", (set_id,)).fetchone()


def insert_ab_pair(conn: sqlite3.Connection, pair_id: str, brief_id: str, kind: str,
                   step: str | None, rep: int | None, set_a: str, set_b: str) -> None:
    conn.execute(
        "INSERT INTO ab_pairs (id, brief_id, kind, step, rep, set_a, set_b) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (pair_id, brief_id, kind, step, rep, set_a, set_b),
    )


def list_ab_pairs(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM ab_pairs ORDER BY id").fetchall()


def insert_session(conn: sqlite3.Connection, session_id: str, code: str, label: str,
                   tasks: dict, pilot: bool) -> None:
    conn.execute(
        "INSERT INTO sessions (id, code, label, pilot, tasks, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, code, label, int(pilot), json.dumps(tasks), now()),
    )


def real_session_ids(conn: sqlite3.Connection) -> set[str]:
    # Pilot/dry-run sessions never feed results.
    return {row["id"] for row in conn.execute("SELECT id FROM sessions WHERE pilot = 0")}


def list_sessions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM sessions ORDER BY created_at").fetchall()


def get_session_by_code(conn: sqlite3.Connection, code: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM sessions WHERE code = ?", (code,)).fetchone()


def delete_session(conn: sqlite3.Connection, session_id: str) -> None:
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))


def insert_vote(conn: sqlite3.Connection, session_id: str, pair_id: str,
                chosen_set: str, seconds: float | None) -> None:
    conn.execute(
        """INSERT INTO ab_votes (session_id, pair_id, chosen_set, seconds, voted_at)
           VALUES (?, ?, ?, ?, ?)""",
        (session_id, pair_id, chosen_set, seconds, now()),
    )


def delete_vote(conn: sqlite3.Connection, session_id: str, pair_id: str) -> bool:
    cursor = conn.execute(
        "DELETE FROM ab_votes WHERE session_id = ? AND pair_id = ?", (session_id, pair_id)
    )
    return cursor.rowcount > 0


def list_votes(conn: sqlite3.Connection, session_id: str | None = None) -> list[sqlite3.Row]:
    if session_id is None:
        return conn.execute("SELECT * FROM ab_votes").fetchall()
    return conn.execute("SELECT * FROM ab_votes WHERE session_id = ?", (session_id,)).fetchall()


def insert_rating(conn: sqlite3.Connection, session_id: str, set_id: str, position: int,
                  message: int, brand: int, tone: int) -> None:
    conn.execute(
        """INSERT INTO rubric_ratings (session_id, set_id, position, message, brand, tone, rated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (session_id, set_id, position, message, brand, tone, now()),
    )


def list_ratings(conn: sqlite3.Connection, session_id: str | None = None) -> list[sqlite3.Row]:
    if session_id is None:
        return conn.execute("SELECT * FROM rubric_ratings").fetchall()
    return conn.execute("SELECT * FROM rubric_ratings WHERE session_id = ?", (session_id,)).fetchall()
