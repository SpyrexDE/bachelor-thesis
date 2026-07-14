"""Reading side of the mock: it sees exactly what a real model would see.

The mock acts only on the prompt text (and attached images), never on side
channels. Prompts are structured with '## ' headers (topologies/prompts.py), so
the mock parses those sections; whatever a topology leaves out of the prompt is
genuinely invisible to the mock (docs/decisions.md D5).
"""

import re

from grain.providers.base import parse_json_block

__all__ = [
    "split_sections", "section", "platform_sections",
    "brief_field", "brief_list_field", "parse_json_block",
]


def split_sections(prompt: str) -> list[tuple[str, str]]:
    parts: list[tuple[str, str]] = []
    header = "preamble"
    lines: list[str] = []
    for line in prompt.splitlines():
        if line.startswith("## "):
            parts.append((header, "\n".join(lines).strip()))
            header = line[3:].strip().lower()
            lines = []
        else:
            lines.append(line)
    parts.append((header, "\n".join(lines).strip()))
    return [(h, b) for h, b in parts if b]


def section(prompt: str, name: str) -> str | None:
    for header, body in split_sections(prompt):
        if header == name:
            return body
    return None


def platform_sections(prompt: str) -> list[tuple[str, str]]:
    # 'platform' (single-platform prompt) or 'platform: instagram post' (monolithic).
    return [(h, b) for h, b in split_sections(prompt) if h.startswith("platform")]


def brief_field(brief_text: str, field: str) -> str:
    match = re.search(rf"^{re.escape(field)}: (.+)$", brief_text, re.MULTILINE)
    if not match:
        raise ValueError(f"brief text lacks field '{field}'")
    return match.group(1).strip()


def brief_list_field(brief_text: str, field: str) -> list[str]:
    match = re.search(rf"^\s*{re.escape(field)}: (.+)$", brief_text, re.MULTILINE)
    if not match:
        return []
    return [item.strip() for item in match.group(1).split(";") if item.strip()]
