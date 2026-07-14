"""Seed derivation. Every call's seed is recorded for reproducibility (concept/02)."""

import hashlib


def derive_seed(*parts: object) -> int:
    digest = hashlib.sha256(":".join(str(p) for p in parts).encode()).hexdigest()
    return int(digest[:8], 16)


def run_seed(brief_id: str, topology: str, rep: int) -> int:
    # Default matrix seed; varies across reps, reproducible for the whole matrix.
    return derive_seed("run", brief_id, topology, rep)


def call_seed(run_seed_value: int, key: str) -> int:
    return derive_seed("call", run_seed_value, key)
