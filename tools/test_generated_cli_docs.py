#!/usr/bin/env python3
"""Fence layout checks for CLI and MCP docs (line length, banned placeholders)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

MAX_LINES = 25
MAX_COL = 80
MAX_COL_JSON = 96
BANNED = re.compile(r"<[A-Z0-9_]+>")

ROOT = Path(__file__).resolve().parents[1]
DOC_PATHS = [
    ROOT / "docs" / "features" / "ai-native.md",
    ROOT / "docs" / "index.md",
]


def check_file(path: Path) -> list[str]:
    problems: list[str] = []
    text = path.read_text(encoding="utf-8")
    if BANNED.search(text):
        for m in BANNED.finditer(text):
            line_no = text.count("\n", 0, m.start()) + 1
            problems.append(f"{path}: banned angle-bracket placeholder near line {line_no}")
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            lang = line.strip()[3:].strip() or "text"
            start = i
            i += 1
            body: list[str] = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                body.append(lines[i])
                i += 1
            if i >= len(lines):
                problems.append(f"{path}: unclosed fence from line {start + 1}")
                break
            if len(body) > MAX_LINES:
                problems.append(
                    f"{path}: fence ({lang}) {len(body)} lines exceeds {MAX_LINES} (starts line {start + 1})",
                )
            cap = MAX_COL_JSON if lang == "json" else MAX_COL
            for j, bl in enumerate(body):
                if len(bl) > cap:
                    problems.append(
                        f"{path}: line {start + 2 + j} in {lang} fence: {len(bl)} cols (max {cap})",
                    )
            i += 1
            continue
        i += 1
    return problems


def main() -> int:
    problems: list[str] = []
    for p in DOC_PATHS:
        if not p.is_file():
            problems.append(f"missing {p}")
            continue
        problems.extend(check_file(p))
    if problems:
        print("test_generated_cli_docs failed:\n" + "\n".join(problems), file=sys.stderr)
        return 1
    print("test_generated_cli_docs: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
