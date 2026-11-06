"""Self-check for dev/generate_env.py (JWKS JSON parses, no leftover placeholders)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    dev = Path(__file__).resolve().parent
    example = dev / ".env.local.example"
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".env", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        subprocess.check_call(
            [sys.executable, str(dev / "generate_env.py"), str(example), str(out)],
            cwd=str(dev),
        )
        text = out.read_text(encoding="utf-8")
        for line in text.splitlines():
            if line.startswith("GLOBAL_JWKS="):
                raw = line.split("=", 1)[1].strip()
                assert raw[0] == "'" and raw[-1] == "'", "GLOBAL_JWKS must be single-quoted JSON"
                json.loads(raw[1:-1])
                return 0
        print("GLOBAL_JWKS= missing from generated env", file=sys.stderr)
        return 1
    finally:
        out.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
