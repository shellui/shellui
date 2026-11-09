"""Self-check for dev/generate_env.py (JWKS JSON parses, PEM-JWKS match, retention)."""

from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MARKER_LINE = "SHELLUI_AGENT_DOC_RETENTION_TEST=keep_me_across_runs\n"


def load_generate_env_module(dev: Path):
    spec = importlib.util.spec_from_file_location("shellui_generate_env", dev / "generate_env.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run_generator(example: Path, out: Path) -> subprocess.CompletedProcess[str]:
    dev = example.parent
    return subprocess.run(
        [sys.executable, str(dev / "generate_env.py"), str(example), str(out)],
        cwd=str(dev),
        check=True,
        capture_output=True,
        text=True,
    )


def assert_jwks_parses(text: str) -> dict:
    for line in text.splitlines():
        if line.startswith("GLOBAL_JWKS="):
            raw = line.split("=", 1)[1].strip()
            assert raw[0] == "'" and raw[-1] == "'", "GLOBAL_JWKS must be single-quoted JSON"
            assert "BEGIN" not in raw
            doc = json.loads(raw[1:-1])
            keys = doc.get("keys")
            assert isinstance(keys, list) and keys, "GLOBAL_JWKS must list keys"
            assert "n" in keys[0] and "e" in keys[0], "GLOBAL_JWKS must be a public JWKS"
            return doc
    raise AssertionError("GLOBAL_JWKS= missing from generated env")


def jwks_matches_signing_pem(text: str, dev: Path) -> None:
    """GLOBAL_JWKS must equal generate_env.jwks_for_rsa_public_pem from signing PEM."""
    mod = load_generate_env_module(dev)
    pem_line = None
    for line in text.splitlines():
        if line.startswith("GLOBAL_AGENT_SIGNING_KEY="):
            pem_line = line
            break
    assert pem_line, "GLOBAL_AGENT_SIGNING_KEY= missing"
    raw = pem_line.split("=", 1)[1].strip()
    assert raw[0] == raw[-1] == '"', "GLOBAL_AGENT_SIGNING_KEY must be double-quoted PEM"
    pem = raw[1:-1].replace("\\n", "\n")
    doc = assert_jwks_parses(text)
    kid = mod.kid_from_private_pem(pem)
    kid_line = None
    for line in text.splitlines():
        if line.startswith("GLOBAL_AGENT_KEY_ID="):
            kid_line = line.split("=", 1)[1].strip()
            break
    assert kid_line == kid, "GLOBAL_AGENT_KEY_ID must match JWKS kid and derived PEM kid"
    assert doc["keys"][0]["kid"] == kid, "GLOBAL_JWKS kid must match GLOBAL_AGENT_KEY_ID"
    pub = mod.public_pem_from_private(pem)
    expect = json.loads(mod.jwks_for_rsa_public_pem(pub, kid))
    assert doc == expect, "GLOBAL_JWKS must match signing key public material"


def pem_from_env_line(line: str) -> str:
    raw = line.split("=", 1)[1].strip()
    while len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'"', "'"}:
        raw = raw[1:-1]
    return raw.replace("\\n", "\n")


def assert_global_issuer_key_matches(text: str, dev: Path) -> None:
    """identity-global, SaaS agent signing, and GLOBAL_JWKS share one public key on a fresh file."""
    mod = load_generate_env_module(dev)
    lines = {name: line for line in text.splitlines() if (name := line.split("=", 1)[0]) in {
        "GLOBAL_AGENT_SIGNING_KEY",
        "IDENTITY_GLOBAL_JWT_PRIVATE_KEY",
        "IDENTITY_GLOBAL_JWT_KEY_ID",
        "GLOBAL_AGENT_KEY_ID",
        "GLOBAL_CLIENT_ID",
        "IDENTITY_GLOBAL_OIDC_CLIENTS",
    }}
    agent = pem_from_env_line(lines["GLOBAL_AGENT_SIGNING_KEY"])
    issuer = pem_from_env_line(lines["IDENTITY_GLOBAL_JWT_PRIVATE_KEY"])
    assert agent.strip() == issuer.strip(), "global issuer PEM must equal GLOBAL_AGENT_SIGNING_KEY"
    assert "BEGIN" in agent and not agent.lstrip().startswith('"')
    kid = mod.kid_from_private_pem(issuer)
    assert lines["IDENTITY_GLOBAL_JWT_KEY_ID"].split("=", 1)[1].strip() == kid
    assert lines["GLOBAL_AGENT_KEY_ID"].split("=", 1)[1].strip() == kid
    doc = assert_jwks_parses(text)
    assert len(doc["keys"]) == 1
    assert doc["keys"][0]["kid"] == kid
    clients_raw = lines["IDENTITY_GLOBAL_OIDC_CLIENTS"].split("=", 1)[1].strip()
    assert clients_raw[0] == "'" and clients_raw[-1] == "'"
    clients = json.loads(clients_raw[1:-1])
    client_id = lines["GLOBAL_CLIENT_ID"].split("=", 1)[1].strip()
    assert clients[0]["client_id"] == client_id
    assert "http://localhost:8001/oauth/upstream-callback" in clients[0]["redirect_uris"]


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
        "GLOBAL_AGENT_SIGNING_KEY",
        "GLOBAL_AGENT_KEY_ID",
        "GLOBAL_JWKS",
        "GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE",
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
        jwks_matches_signing_pem(first, dev)

        p2 = run_generator(example, seeded)
        assert "eyJ" not in (p2.stdout or "") and "eyJ" not in (p2.stderr or "")
        second = seeded.read_text(encoding="utf-8")
        assert second.count(MARKER_LINE.strip()) == 1, "duplicate retention marker lines"
        after = global_signing_lines(second)
        assert before == after, "global signing material changed on re-run with existing file"
        jwks_matches_signing_pem(second, dev)
        assert not re.search(
            r"^GLOBAL_AGENT_PRIVATE_KEY=",
            second,
            re.MULTILINE,
        ), "legacy GLOBAL_AGENT_PRIVATE_KEY must be removed after regen"


def test_fresh_file_round_trip_and_adoption() -> None:
    """A missing output file must be readable on the next run, and an old agent key is reused."""
    dev = Path(__file__).resolve().parent
    example = dev / ".env.local.example"
    with tempfile.TemporaryDirectory() as tmp:
        tdir = Path(tmp)
        fresh = tdir / "fresh.env"
        assert not fresh.exists()
        run_generator(example, fresh)
        first = fresh.read_text(encoding="utf-8")
        assert_global_issuer_key_matches(first, dev)
        jwks_matches_signing_pem(first, dev)
        run_generator(example, fresh)
        second = fresh.read_text(encoding="utf-8")
        assert global_signing_lines(first) == global_signing_lines(second)
        assert_global_issuer_key_matches(second, dev)

        adopted = tdir / "adopted.env"
        agent_line = next(line for line in first.splitlines() if line.startswith("GLOBAL_AGENT_SIGNING_KEY="))
        adopted.write_text("POSTGRES_PASSWORD=keep-me\n" + agent_line + "\n", encoding="utf-8")
        run_generator(example, adopted)
        body = adopted.read_text(encoding="utf-8")
        assert "POSTGRES_PASSWORD=keep-me" in body
        assert body.count("POSTGRES_PASSWORD=") == 1
        kept = next(line for line in body.splitlines() if line.startswith("GLOBAL_AGENT_SIGNING_KEY="))
        assert kept == agent_line
        issuer = next(line for line in body.splitlines() if line.startswith("IDENTITY_GLOBAL_JWT_PRIVATE_KEY="))
        assert pem_from_env_line(issuer).strip() == pem_from_env_line(agent_line).strip()
        assert_no_duplicate_var_definitions(body)


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
        jwks_matches_signing_pem(text, dev)
        assert_global_issuer_key_matches(text, dev)
        assert_no_duplicate_var_definitions(text)
        assert not re.search(r"^GLOBAL_AGENT_PRIVATE_KEY=", text, re.MULTILINE)
        test_retention_preserves_secrets()
        test_fresh_file_round_trip_and_adoption()
        return 0
    finally:
        out.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
