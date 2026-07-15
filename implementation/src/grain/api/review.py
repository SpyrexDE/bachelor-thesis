import json
import os
from sqlite3 import Connection, IntegrityError

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from grain.analysis.humans import ab_results, rubric_results
from grain.api.deps import get_conn
from grain.domain.platforms import PLATFORMS
from grain.review.plan import final_artifacts, generate_plan
from grain.review.sessions import (
    allowed_sets,
    create_session,
    record_rating,
    record_vote,
    session_progress,
)
from grain.store import review as review_store

router = APIRouter(prefix="/api/review")


class PlanRequest(BaseModel):
    seed: int | None = None
    within_count: int = 9
    force: bool = False


class SessionRequest(BaseModel):
    label: str
    ab: bool = True
    rubric: bool = False
    pilot: bool = False  # dry-run sessions are excluded from every result


class VoteRequest(BaseModel):
    pair_id: str
    chosen_set: str
    seconds: float | None = None


class RatingRequest(BaseModel):
    set_id: str
    message: int
    brand: int
    tone: int


def set_sources(conn: Connection, set_row) -> dict[str, dict]:
    composition = json.loads(set_row["composition"])
    resolved = {}
    for platform_id, source in composition["sources"].items():
        artifact = final_artifacts(conn, source["run_id"])[platform_id]
        resolved[platform_id] = artifact
    return resolved


@router.post("/plan")
def make_plan(body: PlanRequest, request: Request, conn: Connection = Depends(get_conn)) -> dict:
    if review_store.plan_exists(conn) and not body.force:
        raise HTTPException(409, "a plan exists; force regeneration to discard it and all answers")
    seed = body.seed if body.seed is not None else int.from_bytes(os.urandom(4), "big")
    try:
        summary = generate_plan(conn, request.app.state.settings.data_dir,
                                request.app.state.provider, request.app.state.briefs,
                                seed, body.within_count)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    return summary


@router.get("/plan")
def plan_summary(conn: Connection = Depends(get_conn)) -> dict:
    plan = review_store.get_plan(conn)
    if plan is None:
        return {"exists": False}
    sets = review_store.list_review_sets(conn)
    pairs = review_store.list_ab_pairs(conn)

    # Validity check, step one (concept/03): did the scrambles actually drift,
    # by the judge's own scoring?
    real_scores = [
        row["value"] for row in conn.execute(
            "SELECT m.value FROM metrics m JOIN review_sets s ON s.run_id = m.run_id "
            "WHERE s.kind = 'real' AND m.metric = 'coherence' AND m.scope = 'set'"
        ).fetchall()
    ]
    assembled = {"scramble": [], "anchor_incoherent": []}
    for row in sets:
        if row["kind"] in assembled:
            judge = json.loads(row["composition"]).get("judge")
            if judge:
                assembled[row["kind"]].append(judge["score"])
    real_mean = sum(real_scores) / len(real_scores) if real_scores else None
    scramble_scores = assembled["scramble"]
    return {
        "exists": True,
        "seed": plan["seed"],
        "params": json.loads(plan["params"]),
        "sets": {kind: sum(1 for s in sets if s["kind"] == kind)
                 for kind in ("real", "scramble", "anchor_incoherent", "anchor_strong")},
        "pairs": {kind: sum(1 for p in pairs if p["kind"] == kind)
                  for kind in ("between", "within")},
        "validity": {
            "real_coherence_mean": round(real_mean, 3) if real_mean is not None else None,
            "scramble_judge_scores": scramble_scores,
            "incoherent_anchor_score": (assembled["anchor_incoherent"] or [None])[0],
            "scrambles_drifted": (
                max(scramble_scores) < real_mean
                if scramble_scores and real_mean is not None else None
            ),
        },
    }


@router.delete("/plan")
def delete_plan(conn: Connection = Depends(get_conn)) -> dict:
    review_store.clear_plan(conn)
    return {"deleted": True}


@router.get("/sets")
def list_sets(conn: Connection = Depends(get_conn)) -> list[dict]:
    rows = review_store.list_review_sets(conn)
    result = []
    for row in rows:
        composition = json.loads(row["composition"])
        judge = composition.get("judge")
        result.append({
            "id": row["id"], "kind": row["kind"], "brief": row["brief_id"],
            "run_id": row["run_id"],
            "judge_score": judge["score"] if judge else None,
            "sources": {pid: src["run_id"] for pid, src in composition["sources"].items()},
        })
    return result


@router.get("/sets/{set_id}/image/{platform}")
def set_image(set_id: str, platform: str, request: Request,
              conn: Connection = Depends(get_conn)) -> FileResponse:
    row = review_store.get_review_set(conn, set_id)
    if row is None:
        raise HTTPException(404, "set not found")
    sources = set_sources(conn, row)
    if platform not in sources:
        raise HTTPException(404, "platform not in set")
    return FileResponse(
        request.app.state.settings.data_dir / sources[platform]["image_path"],
        media_type="image/png",
    )


@router.post("/sessions")
def new_session(body: SessionRequest, conn: Connection = Depends(get_conn)) -> dict:
    try:
        return create_session(conn, body.label, body.ab, body.rubric,
                              seed=int.from_bytes(os.urandom(4), "big"), pilot=body.pilot)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


@router.get("/sessions")
def list_sessions(conn: Connection = Depends(get_conn)) -> list[dict]:
    result = []
    for row in review_store.list_sessions(conn):
        progress = session_progress(conn, row)
        result.append({
            "id": row["id"], "code": row["code"], "label": row["label"],
            "pilot": bool(row["pilot"]), "created_at": row["created_at"],
            "stage": progress["stage"], "ab": progress["ab"], "rubric": progress["rubric"],
        })
    return result


@router.delete("/sessions/{session_id}")
def remove_session(session_id: str, conn: Connection = Depends(get_conn)) -> dict:
    review_store.delete_session(conn, session_id)
    return {"deleted": session_id}


@router.get("/results")
def results(conn: Connection = Depends(get_conn)) -> dict:
    return {"ab": ab_results(conn), "rubric": rubric_results(conn)}


# ---- rater-facing endpoints; everything below stays blind ----


def load_session(conn: Connection, code: str):
    session = review_store.get_session_by_code(conn, code.upper())
    if session is None:
        raise HTTPException(404, "unknown session code")
    return session


def brief_payload(request: Request, code: str, brief_id: str) -> dict:
    # Structured elements, not one text blob: the rater panel renders scannable
    # rows, not a wall. The product image is served session-scoped so it stays
    # inside the rater gate (the whole rest of /api is admin-only). Full text
    # still travels for the "full brief" expander.
    brief = request.app.state.briefs[brief_id]
    return {
        "id": brief.id,
        "brand": brief.brand,
        "product": brief.product,
        "objectives": brief.objectives,
        "audience": brief.audience,
        "key_benefit": brief.key_benefit,
        "tone": brief.tone,
        "required_claims": list(brief.mandatories.required_claims),
        "prohibited": list(brief.mandatories.prohibited_wording),
        "image_url": f"/api/review/session/{code}/brief-image/{brief.id}",
        "text": brief.as_text(),
    }


def _xml_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def placeholder_product_svg(brief) -> str:
    # Neutral, theme-agnostic stand-in until real product photos land in
    # briefs/<id>.{png,jpg}. Reads as a deliberate placeholder, not a bug.
    brand = _xml_escape(brief.brand)
    product = _xml_escape(brief.product)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" '
        'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#33383f"/><stop offset="1" stop-color="#22262c"/>'
        '</linearGradient></defs>'
        '<rect width="640" height="480" fill="url(#g)"/>'
        '<rect x="16" y="16" width="608" height="448" rx="14" fill="none" '
        'stroke="#4c525b" stroke-width="2" stroke-dasharray="9 7"/>'
        '<g transform="translate(320 196)" fill="none" stroke="#6b7280" stroke-width="7" '
        'stroke-linejoin="round" stroke-linecap="round">'
        '<path d="M-52 -30 L0 -58 L52 -30 L52 34 L0 62 L-52 34 Z"/>'
        '<path d="M-52 -30 L0 -2 L52 -30 M0 -2 L0 62"/></g>'
        f'<text x="320" y="330" text-anchor="middle" fill="#e7eaee" '
        f'font-size="34" font-weight="700">{brand}</text>'
        f'<text x="320" y="366" text-anchor="middle" fill="#9aa1ab" '
        f'font-size="18">{product}</text>'
        '<text x="320" y="424" text-anchor="middle" fill="#7b8290" '
        'font-size="13" letter-spacing="1.5">PRODUCT PHOTO · PLACEHOLDER</text>'
        '</svg>'
    )


def set_payload(conn: Connection, request: Request, code: str, set_id: str) -> dict:
    row = review_store.get_review_set(conn, set_id)
    sources = set_sources(conn, row)
    return {
        "set_id": set_id,
        "artifacts": [
            {
                "platform": spec.id,
                "image_url": f"/api/review/session/{code}/image/{set_id}/{spec.id}",
            }
            for spec in PLATFORMS if spec.id in sources
        ],
    }


@router.get("/session/{code}")
def session_state(code: str, request: Request, conn: Connection = Depends(get_conn)) -> dict:
    session = load_session(conn, code)
    progress = session_progress(conn, session)
    state = {
        "label": session["label"], "stage": progress["stage"],
        "ab": progress["ab"], "rubric": progress["rubric"],
    }
    tasks = progress["tasks"]

    if progress["stage"] == "ab":
        votes = {v["pair_id"] for v in review_store.list_votes(conn, session["id"])}
        item = next(i for i in tasks["ab"] if i["pair"] not in votes)
        pair = next(p for p in review_store.list_ab_pairs(conn) if p["id"] == item["pair"])
        left, right = (pair["set_b"], pair["set_a"]) if item["flip"] else (pair["set_a"], pair["set_b"])
        state["current"] = {
            "pair_id": pair["id"],
            "brief": brief_payload(request, code, pair["brief_id"]),
            "left": set_payload(conn, request, code, left),
            "right": set_payload(conn, request, code, right),
        }
    elif progress["stage"] == "rubric":
        rated = {r["set_id"] for r in review_store.list_ratings(conn, session["id"])}
        set_id = next(s for s in tasks["rubric"] if s not in rated)
        row = review_store.get_review_set(conn, set_id)
        state["current"] = {
            "brief": brief_payload(request, code, row["brief_id"]),
            "set": set_payload(conn, request, code, set_id),
        }
    return state


@router.post("/session/{code}/vote")
def vote(code: str, body: VoteRequest, conn: Connection = Depends(get_conn)) -> dict:
    session = load_session(conn, code)
    try:
        record_vote(conn, session, body.pair_id, body.chosen_set, body.seconds)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except IntegrityError as error:
        # Two identical submissions racing past the check; the second loses.
        raise HTTPException(400, "pair already voted") from error
    return {"recorded": True}


@router.delete("/session/{code}/vote/{pair_id}")
def undo_vote(code: str, pair_id: str, conn: Connection = Depends(get_conn)) -> dict:
    # The rater-side undo window right after a vote; a mis-keyed forced choice
    # would otherwise be silent, irreversible thesis data.
    session = load_session(conn, code)
    if not review_store.delete_vote(conn, session["id"], pair_id):
        raise HTTPException(404, "no vote to undo")
    return {"undone": True}


@router.post("/session/{code}/rating")
def rating(code: str, body: RatingRequest, conn: Connection = Depends(get_conn)) -> dict:
    session = load_session(conn, code)
    try:
        record_rating(conn, session, body.set_id, body.message, body.brand, body.tone)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except IntegrityError as error:
        raise HTTPException(400, "set already rated") from error
    return {"recorded": True}


@router.get("/session/{code}/image/{set_id}/{platform}")
def session_image(code: str, set_id: str, platform: str, request: Request,
                  conn: Connection = Depends(get_conn)) -> FileResponse:
    session = load_session(conn, code)
    tasks = json.loads(session["tasks"])
    if set_id not in allowed_sets(tasks, conn):
        raise HTTPException(404, "set not in this session")
    return set_image(set_id, platform, request, conn)


@router.get("/session/{code}/brief-image/{brief_id}")
def brief_image(code: str, brief_id: str, request: Request,
                conn: Connection = Depends(get_conn)) -> Response:
    # Rater-scoped so it clears the blinding gate. Serves a real photo from
    # briefs/<id>.{png,jpg,jpeg,webp} once present; until then a placeholder.
    load_session(conn, code)
    briefs = request.app.state.briefs
    if brief_id not in briefs:
        raise HTTPException(404, "unknown brief")
    briefs_dir = request.app.state.settings.briefs_dir
    for ext in ("png", "jpg", "jpeg", "webp"):
        candidate = briefs_dir / f"{brief_id}.{ext}"
        if candidate.exists():
            return FileResponse(candidate)
    return Response(placeholder_product_svg(briefs[brief_id]),
                    media_type="image/svg+xml",
                    headers={"Cache-Control": "no-store"})
