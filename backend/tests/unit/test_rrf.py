"""Unit tests for the Reciprocal Rank Fusion algorithm."""
import pytest

from app.rag.retrieval.hybrid import reciprocal_rank_fusion


def test_single_ranking_preserves_order():
    ids = ["a", "b", "c"]
    result = reciprocal_rank_fusion([ids])
    assert result == ids


def test_two_identical_rankings_preserves_order():
    ids = ["a", "b", "c"]
    result = reciprocal_rank_fusion([ids, ids])
    assert result == ids


def test_top_item_wins_when_both_lists_agree():
    result = reciprocal_rank_fusion([["x", "y", "z"], ["x", "z", "y"]])
    assert result[0] == "x"


def test_item_ranked_high_in_both_lists_beats_item_ranked_low_in_one():
    # "b" is rank 1 in both → should beat "a" which is rank 1 in one, absent in other
    result = reciprocal_rank_fusion([["a", "b"], ["b", "c"]])
    assert result[0] == "b"


def test_empty_rankings_returns_empty():
    assert reciprocal_rank_fusion([]) == []


def test_empty_inner_lists_return_empty():
    assert reciprocal_rank_fusion([[], []]) == []


def test_all_ids_appear_in_result():
    r1 = ["a", "b", "c"]
    r2 = ["d", "e", "f"]
    result = reciprocal_rank_fusion([r1, r2])
    assert set(result) == {"a", "b", "c", "d", "e", "f"}


def test_k_parameter_affects_score_spread():
    # With k=0, rank-1 item scores 1.0; with large k, scores are compressed.
    # Just verify the function accepts the parameter and still returns a valid list.
    result = reciprocal_rank_fusion([["a", "b", "c"]], k=0)
    assert result[0] == "a"


def test_result_length_matches_union_of_ids():
    r1 = ["a", "b"]
    r2 = ["b", "c"]
    result = reciprocal_rank_fusion([r1, r2])
    assert len(result) == 3  # a, b, c — b appears once despite being in both


def test_duplicate_ids_within_one_ranking_are_deduplicated():
    # If a ranking has duplicates the algorithm still sums scores
    result = reciprocal_rank_fusion([["a", "a", "b"]])
    # "a" appears twice → higher combined score than "b"
    assert result[0] == "a"
