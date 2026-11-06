"""Self-check for dev/generate_env.py (JWKS JSON parses, retention)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

MARKER_LINE = "SHELLUI_AGENT_DOC_RETENTION_TEST=keep_me_across_runs\n"


def run_generator(example: Path, out: Path) -> subprocess.CompletedProcess[str]:
    dev = example.parent
    return subprocess.run(
        [sys.executable, str(dev / "generate_env.py"), str(example), str(out)],
        cwd=str(dev),
        check=True,
        capture_output=True,
        text=True,
    )


def assert_jwks_parses(text: str) -> None:
    for line in text.splitlines():
        if line.startswith("GLOBAL_JWKS="):
            raw = line.split("=", 1)[1].strip()
            assert raw[0] == "'" and raw[-1] == "'", "GLOBAL_JWKS must be single-quoted JSON"
            assert "BEGIN" not in raw
            doc = json.loads(raw[1:-1])
            keys = doc.get("keys")
            assert isinstance(keys, list) and keys, "GLOBAL_JWKS must list keys"
            assert "n" in keys[0] and "e" in keys[0], "GLOBAL_JWKS must be a public JWKS"
            return
    raise AssertionError("GLOBAL_JWKS= missing from generated env")


def assert_no_duplicate_var_definitions(text: str) -> None:
    counts: dict[str, int] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        name = stripped.split("=", 1)[0].strip()
        if name:
            counts[name] = counts.get(name, 0) + 1
    dups = [k for k, v in counts.items() if v > 1]
    assert not dups, f"duplicate env keys in output: {', '.join(dups)}"


def global_signing_lines(text: str) -> dict[str, str]:
    """Lines for global agent signing material (must not change on append-only regen)."""
    wanted = (
        "GLOBAL_AGENT_PRIVATE_KEY",
        "GLOBAL_AGENT_SIGNING_KEY",
        "GLOBAL_JWKS",
        "GLOBAL_AGENT_KEY_ID",
        "GLOBAL_AGENT_SIGNING_KID",
    )
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
        p1 = run_generator(example, seeded)
        assert "eyJ" not in (p1.stdout or "") and "eyJ" not in (p1.stderr or "")
        first = seeded.read_text(encoding="utf-8")
        assert MARKER_LINE.strip() in first
        before = global_signing_lines(first)

        p2 = run_generator(example, seeded)
        assert "eyJ" not in (p2.stdout or "") and "eyJ" not in (p2.stderr or "")
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
        p0 = run_generator(example, out)
        assert "eyJ" not in (p0.stdout or "") and "eyJ" not in (p0.stderr or "")
        text = out.read_text(encoding="utf-8")
        assert_jwks_parses(text)
        assert_no_duplicate_var_definitions(text)
        test_retention_preserves_secrets()
        return 0
    finally:
        out.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
