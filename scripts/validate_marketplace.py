#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKETPLACE = ROOT / ".agents" / "plugins" / "marketplace.json"
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")


def main() -> None:
    if not MARKETPLACE.is_file():
        fail("missing .agents/plugins/marketplace.json")

    marketplace = load_json(MARKETPLACE)
    if not marketplace.get("name") or not isinstance(marketplace.get("plugins"), list):
        fail("marketplace must define name and plugins[]")

    seen = set()
    for entry in marketplace["plugins"]:
        name = entry.get("name")
        if not name or name in seen:
            fail(f"missing or duplicate plugin name: {name!r}")
        seen.add(name)

        source = entry.get("source", {})
        if source.get("source") != "local" or not source.get("path"):
            fail(f"{name}: source must be local with a relative path")

        policy = entry.get("policy", {})
        if policy.get("installation") not in {"NOT_AVAILABLE", "AVAILABLE", "INSTALLED_BY_DEFAULT"}:
            fail(f"{name}: invalid installation policy")
        if policy.get("authentication") not in {"ON_INSTALL", "ON_USE"}:
            fail(f"{name}: invalid authentication policy")
        if not entry.get("category"):
            fail(f"{name}: category is required")

        plugin_dir = (ROOT / source["path"]).resolve()
        try:
            plugin_dir.relative_to(ROOT)
        except ValueError:
            fail(f"{name}: plugin path escapes repository")

        manifest_path = plugin_dir / ".codex-plugin" / "plugin.json"
        if not manifest_path.is_file():
            fail(f"{name}: missing .codex-plugin/plugin.json")
        manifest = load_json(manifest_path)
        if manifest.get("name") != name:
            fail(f"{name}: plugin manifest name does not match marketplace")
        if not SEMVER.match(manifest.get("version", "")):
            fail(f"{name}: version must be semver")
        if not manifest.get("description") or not manifest.get("author", {}).get("name"):
            fail(f"{name}: description and author.name are required")
        interface = manifest.get("interface", {})
        for field in ("displayName", "shortDescription", "longDescription", "developerName", "category"):
            if not interface.get(field):
                fail(f"{name}: interface.{field} is required for this POC")

        skills_dir = plugin_dir / "skills"
        skill_files = list(skills_dir.glob("*/SKILL.md"))
        if not skill_files:
            fail(f"{name}: no skills/*/SKILL.md found")
        for skill_file in skill_files:
            text = skill_file.read_text(encoding="utf-8")
            if not text.startswith("---\n") or "\nname:" not in text or "\ndescription:" not in text:
                fail(f"{skill_file.relative_to(ROOT)}: invalid or missing skill frontmatter")

        print(f"OK: {name}")

    print(f"Validated {len(seen)} plugin(s) in {marketplace['name']}")


if __name__ == "__main__":
    main()
