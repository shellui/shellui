"""Self-check for dev/generate_env.py (JWKS JSON parses, retention)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

MARKER_LINE = "SHELLUI_AGENT_DOC_RETENTION_TEST=keep_me_across_runs\n"


def run_generator(example: Path, out: Path) -> None:
    dev = example.parent
    subprocess.check_call(
        [sys.executable, str(dev / "generate_env.py"), str(example), str(out)],
        cwd=str(dev),
    )


def assert_jwks_parses(text: str) -> None:
    for line in text.splitlines():
        if line.startswith("GLOBAL_JWKS="):
            raw = line.split("=", 1)[1].strip()
            assert raw[0] == "'" and raw[-1] == "'", "GLOBAL_JWKS must be single-quoted JSON"
            json.loads(raw[1:-1])
            return
    raise AssertionError("GLOBAL_JWKS= missing from generated env")


def global_signing_lines(text: str) -> dict[str, str]:
    """Lines for global agent signing material (must not change on append-only regen)."""
    wanted = ("GLOBAL_AGENT_PRIVATE_KEY", "GLOBAL_JWKS", "GLOBAL_AGENT_KEY_ID")
    out: dict[str, str] = {}
    for line in text.splitlines():
        for key in wanted:
            if line.startswith(key + "="):
                out[key] = line
    return out


def test_retention_preserves_secrets() -> None:
    dev = Path(__file__).resolve().parent
    example = dev / ".env.local.example"
    with tempfile.TemporaryDirectory() as tmp:
        tdir = Path(tmp)
        seeded = tdir / "seeded.env"
        seeded.write_text(MARKER_LINE, encoding="utf-8")
        run_generator(example, seeded)
        first = seeded.read_text(encoding="utf-8")
        assert MARKER_LINE.strip() in first
        before = global_signing_lines(first)

        run_generator(example, seeded)
        second = seeded.read_text(encoding="utf-8")
        assert second.count(MARKER_LINE.strip()) == 1, "duplicate retention marker lines"
        after = global_signing_lines(second)
        assert before == after, "global signing material changed on re-run with existing file"


def main() -> int:
    dev = Path(__file__).resolve().parent
    example = dev / ".env.local.example"
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".env", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        run_generator(example, out)
        text = out.read_text(encoding="utf-8")
        assert_jwks_parses(text)
        test_retention_preserves_secrets()
        return 0
    finally:
        out.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
