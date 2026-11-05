#!/usr/bin/env python3
"""Shellui dev stack: Django runserver with a slower StatReloader on bind mounts."""
from __future__ import annotations

import ast
import os
import sys
from pathlib import Path


def _patch_stat_reloader_sleep() -> None:
    try:
        from django.utils import autoreload
    except ImportError:
        return
    autoreload.StatReloader.SLEEP_TIME = float(os.environ.get("DJANGO_STATRELOAD_SLEEP", "3"))


def build_runserver_argv(extra_args: list[str] | None = None) -> list[str]:
    """Build argv for Django runserver without duplicating addrport from the shim."""
    extra = list(extra_args if extra_args is not None else sys.argv[1:])
    if extra:
        return ["manage.py", "runserver", *extra]
    return ["manage.py", "runserver", "0.0.0.0:8000"]


def _settings_module_from_manage_py(manage_py: Path) -> str | None:
    source = manage_py.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(manage_py))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (
            isinstance(func, ast.Attribute)
            and func.attr == "setdefault"
            and isinstance(func.value, ast.Attribute)
            and func.value.attr == "environ"
            and isinstance(func.value.value, ast.Name)
            and func.value.value.id == "os"
            and len(node.args) >= 2
        ):
            continue
        key, value = node.args[0], node.args[1]
        if (
            isinstance(key, ast.Constant)
            and key.value == "DJANGO_SETTINGS_MODULE"
            and isinstance(value, ast.Constant)
            and isinstance(value.value, str)
        ):
            return value.value
    return None


def find_manage_py(start: Path | None = None) -> Path | None:
    """Return manage.py in the service working directory, if present."""
    candidate = (start or Path.cwd()) / "manage.py"
    if candidate.is_file():
        return candidate
    return None


def ensure_django_settings_module(manage_py: Path | None = None) -> None:
    """Mirror manage.py's DJANGO_SETTINGS_MODULE default when the shim bypasses it."""
    if os.environ.get("DJANGO_SETTINGS_MODULE"):
        return
    path = manage_py or find_manage_py()
    if path is None:
        return
    module = _settings_module_from_manage_py(path)
    if module:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", module)


def main() -> None:
    _patch_stat_reloader_sleep()
    ensure_django_settings_module()
    argv = build_runserver_argv()
    from django.core.management import execute_from_command_line

    execute_from_command_line(argv)


if __name__ == "__main__":
    main()
