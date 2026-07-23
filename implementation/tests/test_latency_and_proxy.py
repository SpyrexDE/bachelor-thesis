"""Hand-computed pins for the two formulas the other suites only touched
indirectly: latency as the longest path over the call graph (D4), and the
in-loop proxy score (D11)."""

import json

import pytest

from grain.harness.trace import Trace
from grain.metrics.latency import run_latency
from grain.providers.base import ImageRequest
from grain.providers.mock import MockProvider
from grain.topologies.proxy import proxy_score


def record(trace, *, agent, duration, parents=(), purpose="production"):
    return trace.record(
        role=agent.split(":")[0], agent=agent, purpose=purpose, round_=0, seed=1,
        tokens_in=10, tokens_out=10, duration_s=duration, parents=parents,
    )


def test_latency_is_the_longest_path_not_the_sum():
    # Coarse-shaped graph: director (2s), three parallel producers
    # (3s/5s/4s), one image call each (1s), critic over all images (2s).
    trace = Trace()
    director = record(trace, agent="director", duration=2.0, purpose="coordination")
    producers = [
        record(trace, agent=f"producer:{i}", duration=d, parents=(director,))
        for i, d in enumerate((3.0, 5.0, 4.0))
    ]
    images = [
        record(trace, agent=f"image:{i}", duration=1.0, parents=(producer,))
        for i, producer in enumerate(producers)
    ]
    critic = record(trace, agent="critic", duration=2.0,
                    parents=tuple(images), purpose="coordination")

    calls = [{**c, "parents": json.dumps(c["parents"])} for c in trace.as_rows()]
    result = run_latency(calls)
    # Critical path: director -> slowest producer -> its image -> critic.
    assert result["value"] == pytest.approx(2.0 + 5.0 + 1.0 + 2.0)
    assert result["critical_path"] == [director, producers[1], images[1], critic]


def test_parallel_calls_share_the_timeline():
    trace = Trace()
    record(trace, agent="producer:a", duration=4.0)
    record(trace, agent="producer:b", duration=6.0)
    calls = [{**c, "parents": json.dumps(c["parents"])} for c in trace.as_rows()]
    assert run_latency(calls)["value"] == pytest.approx(6.0)  # not 10


STORY_PROMPT = (
    'Story (9:16) creative, 1440x2560. Palette: fir green with off-white '
    '(#1B5E20, #F5F5F0). Motif: crisp white shirt with a single water droplet. '
    'Headline on image: "Numbers first: 20 degrees.". '
    'Style: warm daylight, soft shadows, lived-in setting. Brand block: Persil wordmark.'
)

DRIFTED_PROMPT = (
    'Display banner creative, 300x250. Palette: onyx with signal red '
    '(#141414, #D8232A). Motif: backstage mirror with warm bulbs. '
    'Headline on image: "Dare the mirror.". '
    'Style: studio gloss, high contrast, editorial finish. Brand block: Schwarzkopf wordmark.'
)


def render_to(tmp_path, name, prompt, width, height):
    provider = MockProvider()
    path = tmp_path / name
    path.write_bytes(provider.image(
        ImageRequest(prompt=prompt, width=width, height=height, seed=5)
    ).png)
    return path


def test_proxy_rewards_uniform_sets(tmp_path):
    same_a = render_to(tmp_path, "a.png", STORY_PROMPT, 1440, 2560)
    same_b = render_to(tmp_path, "b.png", STORY_PROMPT.replace("Story (9:16)", "Instagram post"), 1440, 1800)
    drifted = render_to(tmp_path, "c.png", DRIFTED_PROMPT, 300, 250)

    uniform = proxy_score([same_a, same_b])
    mixed = proxy_score([same_a, drifted])
    assert uniform == 1.0  # identical palette and wording
    assert mixed < uniform
    assert 0.0 <= mixed <= 1.0
