#!/usr/bin/env python3
"""Run reference tests, including the real archive corpus, in offline Docker."""
from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tempfile

from refslib import toolbox

ROOT = Path(__file__).resolve().parents[2]
IMAGE = "webseclist-reference-tests:source-workers-4"


def main():
    toolbox.ensure_image()
    if subprocess.run(["docker", "image", "inspect", IMAGE], capture_output=True).returncode:
        dockerfile = "FROM " + toolbox.IMAGE + "\nUSER root\nRUN apk add --no-cache git\nUSER fetcher\n"
        subprocess.run(["docker", "build", "-t", IMAGE, "-"],
                       input=dockerfile.encode(), check=True, timeout=600)
    with tempfile.TemporaryDirectory(prefix="websec_reference_tests_") as folder:
        stage = Path(folder)
        os.chmod(stage, 0o755)
        shutil.copytree(ROOT / "tools/references", stage / "tools/references",
                        ignore=shutil.ignore_patterns("__pycache__", ".tmp", ".env*"))
        shutil.copyfile(ROOT / "tools/capture_pdf.py", stage / "tools/capture_pdf.py")
        shutil.copyfile(ROOT / "tools/sources.json", stage / "tools/sources.json")
        shutil.copytree(ROOT / ".claude/agents", stage / ".claude/agents")
        for path in ROOT.glob("*.md"):
            if re.fullmatch(r"\d{4}(?:-\d{2}|-ai)?\.md", path.name):
                shutil.copyfile(path, stage / path.name)
        (stage / "archived-references/md").mkdir(parents=True)
        (stage / "original-listings").mkdir()
        # A new empty fixture repository establishes the expected root. Never
        # expose the real Git directory, configuration, history or credentials.
        subprocess.run(["git", "init", "-q", str(stage)], check=True)
        command = ["docker", "run"] + toolbox.run_args()
        command[command.index("--network") + 1] = "none"
        command[command.index("--tmpfs") + 1] = "/tmp:rw,noexec,nosuid,size=128m"
        command += ["-v", str(stage) + ":/work:ro", "-v",
                    str(ROOT / "archived-references/md") + ":/work/archived-references/md:ro",
                    "-v", str(ROOT / "original-listings") + ":/work/original-listings:ro",
                    # Trust only this disposable fixture Git root. Docker
                    # Desktop can map its ownership differently from the
                    # non-root worker; never alter the host's Git config.
                    "-e", "GIT_CONFIG_COUNT=1", "-e", "GIT_CONFIG_KEY_0=safe.directory",
                    "-e", "GIT_CONFIG_VALUE_0=/work",
                    "--workdir", "/work", IMAGE, "python", "-B", "-m", "unittest",
                    "discover", "-s", "tools/references/tests", "-t", "tools/references"]
        result = toolbox._run_container(command, timeout=300)
        sys.stdout.write(result.stdout.decode("utf-8", "replace"))
        sys.stderr.write(result.stderr.decode("utf-8", "replace"))
        return result.returncode


if __name__ == "__main__":
    sys.exit(main())
