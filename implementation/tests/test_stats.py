"""Hand-worked examples pin the hand-rolled statistics (docs/decisions.md D9)."""

import pytest

from grain.analysis.stats import box, cohen_kappa, ranks, spearman, wilson_ci


def test_spearman_perfect_monotone():
    assert spearman([1, 2, 3, 4], [10, 20, 30, 40]) == 1.0
    assert spearman([1, 2, 3, 4], [40, 30, 20, 10]) == -1.0


def test_spearman_hand_worked():
    # Ranks x: [1,2,3,4,5], y: [2,1,4,3,5] -> d^2 sum = 4 -> rho = 1 - 24/120 = 0.8
    assert spearman([10, 20, 30, 40, 50], [15, 5, 35, 25, 45]) == pytest.approx(0.8)


def test_spearman_ties_get_average_ranks():
    assert ranks([7, 7, 9]) == [1.5, 1.5, 3.0]


def test_spearman_degenerate_returns_none():
    assert spearman([1, 1, 1], [2, 3, 4]) is None
    assert spearman([1, 2], [2, 3]) is None  # too few points


def test_cohen_kappa_hand_worked():
    # Classic 2x2 example: 20 items, observed agreement 0.7, expected 0.5 -> kappa 0.4
    a = ["y"] * 7 + ["y"] * 3 + ["n"] * 3 + ["n"] * 7
    b = ["y"] * 7 + ["n"] * 3 + ["y"] * 3 + ["n"] * 7
    assert cohen_kappa(a, b) == pytest.approx(0.4)


def test_cohen_kappa_perfect_and_degenerate():
    assert cohen_kappa(["a", "b", "a"], ["a", "b", "a"]) == 1.0
    assert cohen_kappa(["a", "a"], ["a", "a"]) is None  # expected agreement is 1


def test_wilson_ci_hand_worked():
    # 8/10, z=1.96: centre 0.7167, margin 0.2266 -> [0.4902, 0.9433]
    low, high = wilson_ci(8, 10)
    assert low == pytest.approx(0.4902, abs=1e-3)
    assert high == pytest.approx(0.9433, abs=1e-3)
    assert wilson_ci(0, 0) == (0.0, 1.0)


def test_box_quartiles():
    result = box([1, 2, 3, 4, 5, 6, 7, 8])
    assert result["median"] == 4.5
    assert result["q1"] == 2.75
    assert result["q3"] == 6.25
    assert result["min"] == 1 and result["max"] == 8
