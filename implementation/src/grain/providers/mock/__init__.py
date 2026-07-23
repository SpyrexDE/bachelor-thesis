from random import Random

from grain.providers.base import ChatRequest, ChatResponse, ImageRequest, ImageResponse
from grain.providers.mock import agents, judges
from grain.providers.mock.render import render
from grain.providers.mock.text import chat_duration, estimate_tokens, image_duration

# Flat per-image stand-in for vision input tokens; counts wherever a call
# attaches images (the critic's set review, the judges).
VISION_TOKENS_PER_IMAGE = 760


class MockProvider:
    name = "mock"

    def chat(self, request: ChatRequest) -> ChatResponse:
        if request.role == "director":
            text = agents.direct(request.prompt, request.seed)
        elif request.role == "producer":
            text = agents.produce(request.prompt, request.seed)
        elif request.role == "critic":
            text = agents.critique(request.prompt, request.seed, request.images)
        elif request.role == "judge_viescore":
            text = judges.viescore(request.prompt, request.seed, request.images)
        elif request.role == "judge_coherence":
            text = judges.coherence(request.prompt, request.seed, request.images)
        else:
            raise ValueError(f"unknown chat role: {request.role}")

        tokens_out = estimate_tokens(text)
        return ChatResponse(
            text=text,
            tokens_in=estimate_tokens(request.prompt) + VISION_TOKENS_PER_IMAGE * len(request.images),
            tokens_out=tokens_out,
            duration_s=chat_duration(tokens_out, Random(request.seed)),
            prompt=request.prompt,
        )

    def image(self, request: ImageRequest) -> ImageResponse:
        return ImageResponse(
            png=render(request.prompt, request.width, request.height, request.seed),
            tokens_in=estimate_tokens(request.prompt),
            duration_s=image_duration(Random(request.seed)),
        )
