"""Rater sessions: per-rater task order, blinding, progress, and answer
recording. Order rules from concept/03: A/B pairs grouped by brief with the
brief in view, rubric strictly after all A/B blocks, anchors first, set order
randomised per session."""

import json
import sqlite3
import uuid
from random import Random

from grain.store import review as review_store

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no lookalikes


def new_code(rng: Random) -> str:
    return "".join(rng.choice(CODE_ALPHABET) for _ in range(6))


def create_session(conn: sqlite3.Connection, label: str, include_ab: bool,
                   include_rubric: bool, seed: int, pilot: bool = False) -> dict:
    if not (include_ab or include_rubric):
        raise ValueError("a session needs at least one task")
    rng = Random(seed)
    tasks: dict = {}

    if include_ab:
        pairs = review_store.list_ab_pairs(conn)
        if not pairs:
            raise ValueError("no review plan; generate it first")
        by_brief: dict[str, list] = {}
        for pair in pairs:
            by_brief.setdefault(pair["brief_id"], []).append(pair["id"])
        brief_order = sorted(by_brief)
        rng.shuffle(brief_order)
        ab_items = []
        for brief_id in brief_order:
            pair_ids = by_brief[brief_id]
            rng.shuffle(pair_ids)
            ab_items.extend(
                {"pair": pair_id, "flip": rng.random() < 0.5} for pair_id in pair_ids
            )
        tasks["ab"] = ab_items

    if include_rubric:
        sets = review_store.list_review_sets(conn)
        if not sets:
            raise ValueError("no review plan; generate it first")
        anchors = {row["kind"]: row["id"] for row in sets if row["kind"].startswith("anchor")}
        rated_pool = [row["id"] for row in sets if row["kind"] in ("real", "scramble")]
        rng.shuffle(rated_pool)
        tasks["rubric"] = [anchors["anchor_incoherent"], anchors["anchor_strong"], *rated_pool]

    session_id = uuid.uuid4().hex[:12]
    code = new_code(rng)
    while review_store.get_session_by_code(conn, code) is not None:
        code = new_code(rng)
    review_store.insert_session(conn, session_id, code, label, tasks, pilot)
    return {"id": session_id, "code": code, "label": label, "pilot": pilot,
            "ab": len(tasks.get("ab", [])), "rubric": len(tasks.get("rubric", []))}


def session_progress(conn: sqlite3.Connection, session: sqlite3.Row) -> dict:
    tasks = json.loads(session["tasks"])
    votes = {v["pair_id"] for v in review_store.list_votes(conn, session["id"])}
    ratings = {r["set_id"] for r in review_store.list_ratings(conn, session["id"])}

    ab_items = tasks.get("ab", [])
    rubric_items = tasks.get("rubric", [])
    ab_done = sum(1 for item in ab_items if item["pair"] in votes)
    rubric_done = sum(1 for set_id in rubric_items if set_id in ratings)

    if ab_done < len(ab_items):
        stage = "ab"
    elif rubric_done < len(rubric_items):
        stage = "rubric"
    else:
        stage = "done"
    return {
        "stage": stage,
        "ab": {"done": ab_done, "total": len(ab_items)},
        "rubric": {"done": rubric_done, "total": len(rubric_items)},
        "tasks": tasks,
    }


def allowed_sets(tasks: dict, conn: sqlite3.Connection) -> set[str]:
    allowed: set[str] = set(tasks.get("rubric", []))
    pairs = {row["id"]: row for row in review_store.list_ab_pairs(conn)}
    for item in tasks.get("ab", []):
        pair = pairs[item["pair"]]
        allowed.update((pair["set_a"], pair["set_b"]))
    return allowed


def record_vote(conn: sqlite3.Connection, session: sqlite3.Row, pair_id: str,
                chosen_set: str, seconds: float | None) -> None:
    tasks = json.loads(session["tasks"])
    if not any(item["pair"] == pair_id for item in tasks.get("ab", [])):
        raise ValueError("pair is not part of this session")
    pair = next(p for p in review_store.list_ab_pairs(conn) if p["id"] == pair_id)
    if chosen_set not in (pair["set_a"], pair["set_b"]):
        raise ValueError("chosen set does not belong to the pair")
    if any(v["pair_id"] == pair_id for v in review_store.list_votes(conn, session["id"])):
        raise ValueError("pair already voted")
    review_store.insert_vote(conn, session["id"], pair_id, chosen_set, seconds)


def record_rating(conn: sqlite3.Connection, session: sqlite3.Row, set_id: str,
                  message: int, brand: int, tone: int) -> None:
    tasks = json.loads(session["tasks"])
    rubric = tasks.get("rubric", [])
    if set_id not in rubric:
        raise ValueError("set is not part of this session")
    progress = session_progress(conn, session)
    if progress["ab"]["done"] < progress["ab"]["total"]:
        # The rubric is a separate block after all A/B blocks (concept/03);
        # enforced here too, not only by the serving flow.
        raise ValueError("the rubric block opens after all A/B pairs are answered")
    for value in (message, brand, tone):
        if not isinstance(value, int) or not 0 <= value <= 5:
            raise ValueError("pillar scores are integers from 0 to 5")
    if any(r["set_id"] == set_id for r in review_store.list_ratings(conn, session["id"])):
        raise ValueError("set already rated")
    review_store.insert_rating(conn, session["id"], set_id, rubric.index(set_id),
                               message, brand, tone)
