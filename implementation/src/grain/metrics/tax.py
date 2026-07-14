"""Coordination tax: share of tokens spent re-establishing cross-agent coherence
rather than producing artifact content (concept/03)."""


def coordination_tax(calls: list[dict]) -> dict:
    coordination = sum(
        c["tokens_in"] + c["tokens_out"] for c in calls if c["purpose"] == "coordination"
    )
    production = sum(
        c["tokens_in"] + c["tokens_out"] for c in calls if c["purpose"] == "production"
    )
    total = coordination + production
    if total == 0:
        raise ValueError("run has no recorded calls")
    return {
        "value": round(coordination / total, 4),
        "coordination_tokens": coordination,
        "production_tokens": production,
    }
