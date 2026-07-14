from random import Random


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def chat_duration(tokens_out: int, rng: Random) -> float:
    # Plausible API magnitudes: fixed overhead plus ~45 tokens/s, jittered.
    return round(1.2 + tokens_out / 45 + rng.uniform(0.0, 0.8), 2)


def image_duration(rng: Random) -> float:
    return round(6.5 + rng.uniform(0.0, 5.0), 2)
