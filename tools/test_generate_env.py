#!/usr/bin/env python3
"""Run generate-env self-checks and optional compose config validation."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    dev = root / "dev"
    gen_test = dev / "generate_env.test.py"
    r = subprocess.run([sys.executable, str(gen_test)], cwd=str(dev), check=False)
    if r.returncode != 0:
        return r.returncode

    example = dev / ".env.local.example"
    compose = dev / "docker-compose.yml"
    if not example.is_file() or not compose.is_file():
        print("missing dev/.env.local.example or dev/docker-compose.yml", file=sys.stderr)
        return 1

    with tempfile.NamedTemporaryFile(mode="w+", suffix=".env", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        r2 = subprocess.run(
            [sys.executable, str(dev / "generate_env.py"), str(example), str(out)],
            cwd=str(dev),
            check=True,
            capture_output=True,
            text=True,
        )
        assert "eyJ" not in (r2.stdout or "") and "eyJ" not in (r2.stderr or "")
        try:
            subprocess.run(
                [
                    "docker",
                    "compose",
                    "-f",
                    str(compose),
                    "--env-file",
                    str(out),
                    "config",
                ],
                cwd=str(dev.parent),
                check=True,
                capture_output=True,
                text=True,
            )
            print("docker compose config: ok")
        except FileNotFoundError:
            print("docker not available; skipped compose config validation")
        except subprocess.CalledProcessError as exc:
            print(exc.stderr or exc.stdout or exc, file=sys.stderr)
            return exc.returncode
    finally:
        out.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
