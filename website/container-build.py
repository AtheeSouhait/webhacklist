#!/usr/bin/env python3
"""Validate public build inputs and both hosting targets in offline Docker."""
from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools/references"))
from refslib import toolbox

IMAGE = "webseclist-browser-tests:source-workers-4"
WORKER = r'''
import pathlib, shutil, subprocess
root = pathlib.Path('/tmp/work')
shutil.copytree('/inputs', root)
for name in ('archived-references', 'original-listings', 'tools'):
    (root / name).symlink_to('/public/' + name, target_is_directory=True)
def run(*args):
    subprocess.run(args, cwd=root, check=True, timeout=300)
for source in sorted((root / 'website').iterdir()):
    if source.suffix in ('.js', '.mjs'):
        run('node', '--check', str(source))
identities = (root / 'website/story-identities.json').read_bytes()
run('node', 'website/build-data.mjs')
if (root / 'website/story-identities.json').read_bytes() != identities:
    raise RuntimeError('Story identities are stale; regenerate and commit website/story-identities.json')
run('node', 'website/build-data.mjs', '--check')
run('node', 'website/readme-counts-test.mjs')
run('node', 'website/pages-test.mjs')
for target, output in (('cloudflare', 'dist'), ('github', '_site')):
    run('node', 'website/build-site.mjs', '--target', target, '--output', output)
    if not (root / output / 'index.html').is_file():
        raise RuntimeError('Missing staged index for ' + target)
    if target == 'github' and sum(p.stat().st_size for p in (root / output).rglob('*') if p.is_file()) >= 1_000_000_000:
        raise RuntimeError('GitHub Pages artifact exceeds 1 GB')
    shutil.rmtree(root / output)
print('Offline build validation: both hosting targets passed')
'''


def main():
    toolbox.ensure_image()
    if subprocess.run(["docker", "image", "inspect", IMAGE], capture_output=True).returncode:
        subprocess.run(["docker", "build", "-t", IMAGE, "-"],
                       input=(ROOT / "website/Dockerfile.tests").read_bytes(), check=True, timeout=900)
    with tempfile.TemporaryDirectory(prefix="websec_build_validation_") as folder:
        stage = Path(folder)
        os.chmod(stage, 0o755)
        shutil.copytree(ROOT / "website", stage / "website",
                        ignore=shutil.ignore_patterns("data", "node_modules", ".tmp", ".env*", "__pycache__"))
        shutil.copyfile(ROOT / ".gitignore", stage / ".gitignore")
        for source in ROOT.glob("*.md"):
            if re.fullmatch(r"\d{4}(?:-\d{2}|-ai)?\.md", source.name) or source.name in ("README.md", "CONTRIBUTING.md"):
                shutil.copyfile(source, stage / source.name)
        command = ["docker", "run", *toolbox.run_args()]
        command[command.index("--network") + 1] = "none"
        command[command.index("--memory") + 1] = "4g"
        command[command.index("--tmpfs") + 1] = "/tmp:rw,noexec,nosuid,size=3g"
        command += ["-v", str(stage) + ":/inputs:ro"]
        for name in ("archived-references", "original-listings"):
            command += ["-v", str(ROOT / name) + ":/public/" + name + ":ro"]
        command += ["-v", str(ROOT / "tools/references/related-sources.json") + ":/public/tools/references/related-sources.json:ro",
                    IMAGE, "python3", "-I", "-B", "-c", WORKER]
        result = toolbox._run_container(command, timeout=900)
        sys.stdout.write(result.stdout.decode("utf-8", "replace"))
        sys.stderr.write(result.stderr.decode("utf-8", "replace"))
        return result.returncode


if __name__ == "__main__":
    sys.exit(main())
