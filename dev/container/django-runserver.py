#!/usr/bin/env python3
"""Shellui dev stack: Django runserver with a slower StatReloader on bind mounts."""
from __future__ import annotations

import os
import sys


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


def main() -> None:
    _patch_stat_reloader_sleep()
    argv = build_runserver_argv()
    from django.core.management import execute_from_command_line

    execute_from_command_line(argv)


if __name__ == "__main__":
    main()
