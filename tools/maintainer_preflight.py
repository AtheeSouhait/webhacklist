#!/usr/bin/env python3
"""Read-only maintainer environment checks; never install, build or fetch."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "tools/references"))
from refslib import toolbox

PLAYWRIGHT_VERSION = "1.55.0"
AXE_VERSION = "4.13.0"
CHROMIUM_IMAGE = "webseclist-browser-tests:source-workers-4"
CROSS_IMAGE = "webseclist-browser-tests:cross-browser-1.55.0"
REFERENCE_IMAGE = "webseclist-reference-tests:source-workers-4"
PACKAGE_FILES = {"playwright": ("index.mjs", "index.js"),
                 "playwright-core": ("index.mjs", "index.js"),
                 "axe-core": ("axe.min.js",)}


def command(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=15)
        return result.returncode == 0, result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return False, ""


def checks(node_modules=None, browsers=("chromium",)):
    results = []

    def add(name, passed, detail):
        results.append({"check": name, "ok": bool(passed), "detail": detail})

    add("Python", sys.version_info >= (3, 10), "Python 3.10+ required; found " + sys.version.split()[0])
    add("PyYAML", importlib.util.find_spec("yaml") is not None,
        "Install tools/requirements.txt in the Python environment used for skill checks")
    ok, version = command(["node", "--version"])
    match = re.fullmatch(r"v(\d+)\.\d+\.\d+", version)
    add("Node", ok and match and int(match[1]) >= 22, "Node 22+ required; found " + (version or "unavailable"))
    ok, _ = command(["git", "--version"])
    add("Git", ok, "Required by generated-data guards and reference fixtures")
    ok, version = command(["docker", "version", "--format", "{{.Server.Version}}"])
    add("Docker daemon", ok, "Server " + version if ok else "Docker unavailable; check daemon/context and access permissions")
    cross = tuple(browsers) != ("chromium",)
    for image in (toolbox.IMAGE, REFERENCE_IMAGE, CROSS_IMAGE if cross else CHROMIUM_IMAGE):
        present, _ = command(["docker", "image", "inspect", image]) if ok else (False, "")
        add("Image " + image, present, "Must already be built; preflight never pulls or builds images")
    if node_modules is None:
        add("Browser packages", False, "Pass --node-modules with the approved external test dependency directory")
    else:
        for name, expected in (("playwright", PLAYWRIGHT_VERSION), ("playwright-core", PLAYWRIGHT_VERSION), ("axe-core", AXE_VERSION)):
            try:
                version = json.loads((node_modules / name / "package.json").read_text(encoding="utf-8"))["version"]
            except (OSError, ValueError, KeyError, TypeError):
                version = "unavailable"
            add(name, version == expected, "Expected " + expected + "; found " + str(version))
            missing = [file for file in PACKAGE_FILES[name] if not (node_modules / name / file).is_file()]
            add(name + " entrypoints", not missing, "Missing " + ", ".join(missing) if missing else "Required runtime files present")
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node-modules", type=Path)
    parser.add_argument("--browsers", nargs="+", choices=("chromium", "chrome", "msedge", "firefox", "webkit", "all"), default=["chromium"])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    results = checks(args.node_modules, tuple(args.browsers))
    if args.json:
        print(json.dumps({"ok": all(row["ok"] for row in results), "checks": results}))
    else:
        for row in results:
            print(("PASS" if row["ok"] else "FAIL") + " " + row["check"] + ": " + row["detail"])
        print("Browser executables are checked when the isolated suites launch; no browser is launched by preflight.")
    return 0 if all(row["ok"] for row in results) else 1


if __name__ == "__main__":
    sys.exit(main())
