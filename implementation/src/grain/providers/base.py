import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class ChatRequest:
    prompt: str
    role: str  # orchestrator | producer | critic | judge_viescore | judge_coherence
    seed: int
    images: tuple[Path, ...] = ()


@dataclass(frozen=True)
class ChatResponse:
    text: str
    tokens_in: int
    tokens_out: int
    duration_s: float
    prompt: str = ""  # the exact prompt this answered, echoed back for the trace drill-down


@dataclass(frozen=True)
class ImageRequest:
    prompt: str
    width: int
    height: int
    seed: int


@dataclass(frozen=True)
class ImageResponse:
    png: bytes
    tokens_in: int
    duration_s: float


class Provider(Protocol):
    """Every model call in the system goes through this seam (docs/architecture.md).

    Real providers report measured durations; the mock reports simulated ones
    (docs/decisions.md D4). A chat request may carry image paths, standing in for
    the vision input a VLM call would receive.
    """

    name: str

    def chat(self, request: ChatRequest) -> ChatResponse: ...

    def image(self, request: ImageRequest) -> ImageResponse: ...


def parse_json_block(text: str) -> dict:
    # Models are instructed to answer with fenced JSON; tolerate a bare object.
    match = re.search(r"```json\s*(.*?)```", text, re.DOTALL)
    payload = match.group(1) if match else text
    return json.loads(payload)
