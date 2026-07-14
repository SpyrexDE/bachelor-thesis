"""Pins the rules the concept fixes. A failing test here means the code drifted
from concept/; the fix is never to change the expectation (docs/conventions.md)."""

import json
from pathlib import Path

import pytest

from grain.domain.platforms import BANNER, INSTAGRAM, PLATFORMS, STORY
from grain.domain.topology import STEPS, Topology
from grain.metrics.judging import viescore_prompt
from grain.metrics.tax import coordination_tax
from grain.metrics.viescore import overall
from grain.agents.messages import SetCritique
from grain.store import runs as run_store
from grain.topologies.prompts import monolithic_prompt, producer_prompt
from grain.topologies.stopping import HARD_CAP, should_stop
from tests.conftest import record_run, requires_tesseract


@pytest.fixture(scope="module")
def brief(briefs):
    return briefs["persil"]


# --- concept/02: task and matrix constants ---------------------------------

def test_platform_specs_match_concept():
    assert (INSTAGRAM.width, INSTAGRAM.height) == (1440, 1800)
    assert (STORY.width, STORY.height) == (1440, 2560)
    assert (BANNER.width, BANNER.height) == (300, 250)
    assert INSTAGRAM.caption_max_chars == 2200 and INSTAGRAM.hashtag_max == 30
    assert STORY.safe_zone.top == 0.14
    assert STORY.safe_zone.bottom == 0.35
    assert STORY.safe_zone.side == 0.06
    assert not STORY.has_caption and not BANNER.has_caption


def test_matrix_dimensions(briefs):
    assert len(briefs) == 3
    assert len(list(Topology)) == 4
    assert len(STEPS) == 3  # the three adjacent comparison steps, concept/01


# --- concept/01: fair comparison -------------------------------------------

def test_independent_is_producer_prompt_minus_concept(brief):
    with_concept = producer_prompt(brief, INSTAGRAM, concept="CONCEPT-PLACEHOLDER")
    without = producer_prompt(brief, INSTAGRAM)
    # Removing the concept section from the Coarse/Fine prompt must yield the
    # Independent prompt exactly: the absence is the manipulation.
    stripped = with_concept.replace(
        "## Shared creative concept\nCONCEPT-PLACEHOLDER\n\n", ""
    )
    assert stripped == without


def test_monolithic_prompt_combines_platforms_without_coherence_instruction(brief):
    prompt = monolithic_prompt(brief)
    for spec in PLATFORMS:
        assert f"## Platform: {spec.label}" in prompt
    assert "## Shared creative concept" not in prompt
    # No explicit coherence instruction (concept/01): the brief itself may say
    # "coherent" (identical for every topology), the added instructions may not.
    instructions = prompt.replace(brief.as_text(), "")
    assert "coheren" not in instructions.lower()
    assert brief.as_text() in prompt


def test_producer_prompt_carries_full_brief_in_every_variant(brief):
    # Splitting never removes brief information (concept/01, roles).
    for variant in (
        producer_prompt(brief, STORY),
        producer_prompt(brief, STORY, concept="X"),
        producer_prompt(brief, STORY, concept="X", feedback="Y"),
    ):
        assert brief.as_text() in variant


# --- concept/03: coordination tax ------------------------------------------

@requires_tesseract
def test_tax_zero_by_construction_for_uncoordinated(workspace, provider, briefs):
    conn, data_dir = workspace
    for topology in ("monolithic", "independent"):
        run_id = record_run(conn, data_dir, provider, briefs, "persil", topology, 1)
        assert run_store.metric_value(conn, run_id, "tax") == 0.0
        calls = run_store.list_calls(conn, run_id)
        assert all(c["purpose"] == "production" for c in calls)


@requires_tesseract
def test_tax_positive_for_coordinated(workspace, provider, briefs):
    conn, data_dir = workspace
    for topology in ("coarse", "fine"):
        run_id = record_run(conn, data_dir, provider, briefs, "persil", topology, 1)
        assert run_store.metric_value(conn, run_id, "tax") > 0.0


def test_tax_formula():
    calls = [
        {"purpose": "coordination", "tokens_in": 100, "tokens_out": 50},
        {"purpose": "production", "tokens_in": 500, "tokens_out": 350},
    ]
    result = coordination_tax(calls)
    assert result["value"] == round(150 / 1000, 4)


# --- concept/03: VIEScore ----------------------------------------------------

def test_viescore_formula_geometric_mean_of_axis_minimums():
    assert overall({"a": 4, "b": 9}, {"c": 9, "d": 6}) == pytest.approx((4 * 6) ** 0.5, abs=1e-4)


def test_viescore_zero_subscore_zeroes_the_artifact():
    assert overall({"a": 0, "b": 9}, {"c": 9, "d": 8}) == 0.0


def test_viescore_judge_never_sees_the_caption(brief):
    # An image metric: text is judged in set coherence instead (concept/03).
    prompt = viescore_prompt(brief, INSTAGRAM)
    assert "caption:" not in prompt.lower().replace("caption up to", "")
    assert "## Artifacts" not in prompt


# --- concept/03: set coherence min rule -------------------------------------

@requires_tesseract
def test_coherence_score_is_min_over_pillars(workspace, provider, briefs):
    conn, data_dir = workspace
    run_id = record_run(conn, data_dir, provider, briefs, "persil", "coarse", 1)
    row = conn.execute(
        "SELECT value, detail FROM metrics WHERE run_id = ? AND metric = 'coherence' "
        "AND scope = 'set'", (run_id,),
    ).fetchone()
    detail = json.loads(row["detail"])
    assert row["value"] == min(detail["pillars"].values())


# --- concept/01: the critic loop --------------------------------------------

def test_stopping_rule_order_and_cap():
    assert HARD_CAP == 5
    accept = SetCritique(coherent=True, feedback={})
    reject = SetCritique(coherent=False, feedback={"story": "align"})
    # Rule order (concept/01): accept, then gain-below-threshold, then the cap.
    assert should_stop(accept, 0, {0: 0.5}).reason == "accepted"
    assert should_stop(reject, 0, {0: 0.5}).stop is False
    assert should_stop(reject, 1, {0: 0.5, 1: 0.505}).reason == "converged"
    assert should_stop(reject, 1, {0: 0.5, 1: 0.9}).stop is False
    assert should_stop(reject, 5, {r: 0.1 * r for r in range(6)}).reason == "cap"


@requires_tesseract
def test_fine_delivers_the_round_it_stopped_on(workspace, provider, briefs):
    conn, data_dir = workspace
    run_id = record_run(conn, data_dir, provider, briefs, "persil", "fine", 1)
    run = run_store.get_run(conn, run_id)
    assert run["stop_reason"] in ("accepted", "converged", "cap")
    assert run["rounds"] <= HARD_CAP
    final_rounds = {
        row["round"] for row in run_store.list_artifacts(conn, run_id, final_only=True)
    }
    assert final_rounds == {run["rounds"]}


def test_proxy_is_separate_from_the_official_judge():
    # The in-loop stopping signal must not be the official judge (concept/01).
    src = Path(__file__).parents[1] / "src/grain/topologies"
    assert "metrics" not in (src / "proxy.py").read_text()
    for wiring in ("fine.py", "stopping.py"):
        source = (src / wiring).read_text()
        assert "set_coherence" not in source and "judging" not in source


# --- concept/02: seeds and reproducibility -----------------------------------

@requires_tesseract
def test_same_seed_reproduces_the_run(workspace, provider, briefs):
    conn, data_dir = workspace
    first = record_run(conn, data_dir, provider, briefs, "loctite", "coarse", 1, seed=42)
    second = record_run(conn, data_dir, provider, briefs, "loctite", "coarse", 1, seed=42)

    def snapshot(run_id):
        artifacts = run_store.list_artifacts(conn, run_id, final_only=True)
        images = tuple((data_dir / a["image_path"]).read_bytes() for a in artifacts)
        metrics = tuple(sorted(
            (m["metric"], m["scope"], m["value"]) for m in run_store.list_metrics(conn, run_id)
        ))
        return images, metrics

    assert snapshot(first) == snapshot(second)


@requires_tesseract
def test_every_call_records_a_seed(workspace, provider, briefs):
    conn, data_dir = workspace
    run_id = record_run(conn, data_dir, provider, briefs, "schwarzkopf", "fine", 2)
    calls = run_store.list_calls(conn, run_id)
    assert calls
    assert all(isinstance(c["seed"], int) for c in calls)
    # Distinct calls get distinct derived seeds (same run seed, different keys).
    assert len({(c["agent"], c["round"], c["seed"]) for c in calls}) == len(calls)
