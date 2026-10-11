"""Environment failures must be visible without provisioning or source access."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import json

spec = importlib.util.spec_from_file_location("maintainer_preflight", Path(__file__).resolve().parents[1] / "maintainer_preflight.py")
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class PreflightTests(unittest.TestCase):
    def packages(self, root, core="1.55.0"):
        for name, version in (("playwright", "1.55.0"), ("playwright-core", core), ("axe-core", "4.13.0")):
            folder = root / name
            folder.mkdir()
            (folder / "package.json").write_text(json.dumps({"version": version}))
            for filename in preflight.PACKAGE_FILES[name]:
                (folder / filename).write_text("synthetic entrypoint")

    def test_ready_environment_uses_only_read_only_commands(self):
        calls = []

        def command(args):
            calls.append(args)
            return True, "v22.18.0" if args[0] == "node" else "available"

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.packages(root)
            with patch.object(preflight, "command", side_effect=command), patch.object(preflight.importlib.util, "find_spec", return_value=object()):
                self.assertTrue(all(row["ok"] for row in preflight.checks(root, ("firefox", "webkit"))))
        self.assertIn(["docker", "image", "inspect", preflight.CROSS_IMAGE], calls)
        self.assertTrue(all(args[:2] in (["node", "--version"], ["git", "--version"], ["docker", "version"], ["docker", "image"]) for args in calls))

    def test_missing_daemon_does_not_attempt_image_operations(self):
        calls = []

        def command(args):
            calls.append(args)
            return False, ""

        with patch.object(preflight, "command", side_effect=command), patch.object(preflight.importlib.util, "find_spec", return_value=None):
            rows = preflight.checks()
        self.assertTrue(any(row["check"] == "Docker daemon" and not row["ok"] for row in rows))
        self.assertTrue(any(row["check"] == "PyYAML" and not row["ok"] for row in rows))
        self.assertFalse(any(args[:2] == ["docker", "image"] for args in calls))

    def test_package_mismatch_fails_even_with_available_images(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.packages(root, core="1.54.0")
            with patch.object(preflight, "command", return_value=(True, "v22.18.0")):
                rows = preflight.checks(root)
        self.assertTrue(any(row["check"] == "playwright-core" and not row["ok"] for row in rows))

    def test_package_metadata_alone_does_not_establish_readiness(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.packages(root)
            (root / "playwright/index.mjs").unlink()
            with patch.object(preflight, "command", return_value=(True, "v22.18.0")):
                rows = preflight.checks(root)
        self.assertTrue(any(row["check"] == "playwright entrypoints" and not row["ok"] for row in rows))


if __name__ == "__main__":
    unittest.main()
