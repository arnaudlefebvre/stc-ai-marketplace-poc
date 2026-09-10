#!/usr/bin/env python3
"""Smoke-test codex-tokens from marketplace-style versioned plugin roots."""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "codex-tokens"
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def run_cli(plugin_root: Path) -> None:
    cli = plugin_root / "skills" / "codex-tokens" / "cli" / "bin" / "cli.js"
    env = os.environ.copy()
    env["PLUGIN_ROOT"] = str(plugin_root)
    command = ["node", str(cli), "--help"]
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    if "Codex Tokens CLI" not in result.stdout:
        raise AssertionError("CLI help output was not produced")


def main() -> None:
    manifest = json.loads((PLUGIN / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
    if not SEMVER.fullmatch(manifest["version"]):
        raise AssertionError("plugin version is not SemVer")
    if manifest.get("hooks") != "./skills/codex-tokens/hooks.json":
        raise AssertionError("codex-tokens must declare its bundled hooks file")
    hook_text = (PLUGIN / "skills" / "codex-tokens" / "hooks.json").read_text(encoding="utf-8")
    if "PLUGIN_ROOT" not in hook_text or "%USERPROFILE%\\.codex\\skills" in hook_text:
        raise AssertionError("hook must resolve the CLI from PLUGIN_ROOT")
    skill_text = (PLUGIN / "skills" / "codex-tokens" / "SKILL.md").read_text(encoding="utf-8")
    if "~\\.codex\\skills" in skill_text:
        raise AssertionError("skill documentation contains the legacy installation path")

    for version in ("0.1.0", "0.1.1"):
        if not SEMVER.fullmatch(version):
            raise AssertionError(f"invalid test version: {version}")
    run_cli(PLUGIN)
    print("OK: codex-tokens marketplace path and version smoke tests")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, subprocess.SubprocessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)