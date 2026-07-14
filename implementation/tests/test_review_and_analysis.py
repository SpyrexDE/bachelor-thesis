"""Review plan counts and ordering rules (concept/03), analysis shapes
(concept/04), on the full 3x4x3 matrix."""

import json

import pytest

from grain.analysis.machine import distributions, effect_steps, matrix_cells
from grain.analysis.pareto import frontier
from grain.analysis.rounds import round_curve
from grain.providers.registry import get_provider
from grain.review.plan import generate_plan
from grain.review.sessions import create_session, record_rating, record_vote, session_progress
from grain.store import review as review_store


@pytest.fixture(scope="module")
def planned(matrix, briefs):
    conn, data_dir = matrix
    provider = get_provider("mock")
    summary = generate_plan(conn, data_dir, provider, briefs, seed=1234, within_count=9)
    conn.commit()
    return conn, data_dir, summary


def test_between_pairs_are_steps_by_briefs_by_reps(planned):
    conn, _, summary = planned
    pairs = review_store.list_ab_pairs(conn)
    between = [p for p in pairs if p["kind"] == "between"]
    assert len(between) == 27  # 3 steps x 3 briefs x 3 reps (concept/03)
    assert summary["between_count"] == 27
    for pair in between:
        # Every pair shares the brief; between pairs share the rep.
        assert pair["rep"] in (1, 2, 3)
        assert pair["step"] is not None


def test_within_pairs_sampled_to_budget(planned):
    conn, _, _ = planned
    within = [p for p in review_store.list_ab_pairs(conn) if p["kind"] == "within"]
    assert len(within) == 9
    for pair in within:
        sets = {pair["set_a"], pair["set_b"]}
        rows = [review_store.get_review_set(conn, s) for s in sets]
        assert rows[0]["brief_id"] == rows[1]["brief_id"]


def test_set_inventory(planned):
    conn, _, _ = planned
    sets = review_store.list_review_sets(conn)
    by_kind = {}
    for row in sets:
        by_kind.setdefault(row["kind"], []).append(row)
    assert len(by_kind["real"]) == 36
    assert len(by_kind["scramble"]) == 3   # hidden catch sets (concept/03)
    assert len(by_kind["anchor_incoherent"]) == 1
    assert len(by_kind["anchor_strong"]) == 1


def test_scrambles_mix_three_runs_of_the_same_brief(planned):
    conn, _, _ = planned
    for row in review_store.list_review_sets(conn, kind="scramble"):
        sources = json.loads(row["composition"])["sources"]
        run_ids = {src["run_id"] for src in sources.values()}
        assert len(run_ids) == 3
        assert all(run_id.startswith(row["brief_id"]) for run_id in run_ids)


def test_incoherent_anchor_mixes_briefs(planned):
    conn, _, _ = planned
    row = review_store.list_review_sets(conn, kind="anchor_incoherent")[0]
    sources = json.loads(row["composition"])["sources"]
    briefs_used = {run["run_id"].split("-")[0] for run in sources.values()}
    assert len(briefs_used) == 3


def test_session_orders_rubric_after_ab_and_anchors_first(planned):
    conn, _, _ = planned
    session_info = create_session(conn, "tester", include_ab=True, include_rubric=True, seed=7)
    session = review_store.get_session_by_code(conn, session_info["code"])
    tasks = json.loads(session["tasks"])

    anchor_kinds = [
        review_store.get_review_set(conn, set_id)["kind"] for set_id in tasks["rubric"][:2]
    ]
    assert anchor_kinds == ["anchor_incoherent", "anchor_strong"]
    assert len(tasks["rubric"]) == 2 + 36 + 3

    # A/B pairs come grouped by brief: brief changes at most twice over the list.
    pair_briefs = [
        next(p["brief_id"] for p in review_store.list_ab_pairs(conn) if p["id"] == item["pair"])
        for item in tasks["ab"]
    ]
    changes = sum(1 for a, b in zip(pair_briefs, pair_briefs[1:]) if a != b)
    assert changes == 2

    progress = session_progress(conn, session)
    assert progress["stage"] == "ab"  # rubric only unlocks after all A/B blocks


def test_vote_and_rating_validation(planned):
    conn, _, _ = planned
    info = create_session(conn, "validator", include_ab=True, include_rubric=True, seed=11)
    session = review_store.get_session_by_code(conn, info["code"])
    tasks = json.loads(session["tasks"])
    first = tasks["ab"][0]
    pair = next(p for p in review_store.list_ab_pairs(conn) if p["id"] == first["pair"])

    record_vote(conn, session, pair["id"], pair["set_a"], seconds=3.2)
    with pytest.raises(ValueError):
        record_vote(conn, session, pair["id"], pair["set_a"], seconds=1.0)  # double vote
    with pytest.raises(ValueError):
        record_vote(conn, session, pair["id"], "S00000000", seconds=1.0)  # foreign set

    # Rubric strictly after all A/B blocks (concept/03), also on the write path.
    with pytest.raises(ValueError):
        record_rating(conn, session, tasks["rubric"][0], 4, 3, 5)

    rubric_only = create_session(conn, "rubric-only", include_ab=False,
                                 include_rubric=True, seed=12)
    session = review_store.get_session_by_code(conn, rubric_only["code"])
    tasks = json.loads(session["tasks"])
    set_id = tasks["rubric"][0]
    record_rating(conn, session, set_id, 4, 3, 5)
    with pytest.raises(ValueError):
        record_rating(conn, session, set_id, 4, 3, 5)  # double rating
    with pytest.raises(ValueError):
        record_rating(conn, session, tasks["rubric"][1], 6, 0, 0)  # out of scale


def test_machine_distributions_cover_the_matrix(matrix):
    conn, _ = matrix
    cells = matrix_cells(conn)
    assert len(cells) == 36
    dist = distributions(conn, cells)
    for metric in ("coherence", "viescore", "spec", "tax", "latency"):
        for topology in ("monolithic", "independent", "coarse", "fine"):
            assert dist[metric]["topologies"][topology]["box"]["n"] == 9


def test_effect_steps_one_diff_per_brief(matrix):
    conn, _ = matrix
    steps = effect_steps(conn, matrix_cells(conn))
    for metric_steps in steps.values():
        assert [s["step"] for s in metric_steps] == [
            "monolithic-independent", "independent-coarse", "coarse-fine",
        ]
        for step in metric_steps:
            assert len(step["per_brief"]) == 3
            assert "mean" in step and "sd" in step


def test_pareto_zero_tax_positions(matrix):
    conn, _ = matrix
    result = frontier(conn, matrix_cells(conn))
    positions = result["positions"]
    # Fixed in advance (concept/04): the uncoordinated topologies sit at tax 0.
    assert positions["monolithic"]["tax"] == 0.0
    assert positions["independent"]["tax"] == 0.0
    assert positions["coarse"]["tax"] > 0.0
    assert positions["fine"]["tax"] > 0.0
    # At least one zero-tax topology is always on the frontier.
    assert {"monolithic", "independent"} & set(result["frontier"])


def test_spec_error_distribution_beside_the_frontier(matrix):
    conn, _ = matrix
    result = frontier(conn, matrix_cells(conn))
    errors = result["spec_errors"]
    # Which checks failed, how often, per topology (concept/04).
    assert set(errors) == {"monolithic", "independent", "coarse", "fine"}
    for checks in errors.values():
        claim_checks = [name for name in checks if name.startswith("required claim")]
        assert claim_checks, "claim checks must be aggregated"
        for entry in checks.values():
            assert 0 <= entry["failed"] <= entry["total"]
            assert entry["total"] >= 9  # 9 runs per topology, once per artifact


def test_round_curves_only_for_fine(matrix):
    conn, _ = matrix
    curves = round_curve(conn, matrix_cells(conn))
    assert curves, "fine runs must produce curves"
    for curve in curves:
        assert curve["run_id"].startswith(tuple(f"{b}-fine" for b in ("persil", "schwarzkopf", "loctite")))
        rounds = [p["round"] for p in curve["points"]]
        assert rounds == sorted(rounds)
        assert curve["delivered_round"] == rounds[-1]
        tokens = [p["cum_tokens"] for p in curve["points"]]
        assert tokens == sorted(tokens)
