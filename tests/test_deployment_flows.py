import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DeploymentFlowTests(unittest.TestCase):
    def test_hardening_download_failure_never_reaches_transport(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            for command in ['adb', 'ssh']:
                stub = directory / command
                stub.write_text('#!/bin/sh\ntouch "$TOUCHED"\nexit 0\n')
                stub.chmod(0o700)
            curl = directory / 'curl'
            curl.write_text('#!/bin/sh\nexit 22\n'); curl.chmod(0o700)
            touched = directory / 'contacted-device'
            env = {**os.environ, 'PATH': f"{directory}:{os.environ['PATH']}", 'TOUCHED': str(touched)}
            result = subprocess.run(['bash', 'scripts/zharden.sh'], cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(touched.exists(), 'Download failure must precede any modem command')

    def test_shell_wrappers_share_the_verified_transaction_path(self):
        for file in ['setup.sh', 'deploy.sh', 'deploy-dashboard.sh', 'scripts/zharden.sh']:
            with self.subTest(file=file):
                self.assertIn('scripts/deploy-components.py', (ROOT / file).read_text())
        dashboard = (ROOT / 'deploy-dashboard.sh').read_text()
        self.assertLess(dashboard.index('npm ci'), dashboard.index('npm run build'))
        setup = (ROOT / 'setup.sh').read_text()
        self.assertLess(setup.index('"${PREPARE[@]}"'), setup.index('python3 scripts/zunlock.py'))

    def test_tauri_installer_preserves_deployment_guards(self):
        deploy = (ROOT / "installer" / "src-tauri" / "src" / "deploy.rs").read_text()
        app = (ROOT / "installer" / "src" / "App.tsx").read_text()
        production_deploy = deploy.split("#[cfg(test)]", maxsplit=1)[0]

        self.assertIn("__MU5250_RC__", deploy)
        self.assertIn("[ -f /data/bin/dropbear ] && [ -x /data/bin/dropbear ]", deploy)
        self.assertIn("192.168.0.1:9090/api/auth/login", deploy)
        self.assertNotIn("adb forward", production_deploy)
        self.assertIn("/data/bin/dashboard-uhttpd", deploy)
        self.assertIn("start_dashboard.sh", deploy)
        self.assertIn("uci -q delete uhttpd.dashboard", deploy)
        self.assertIn("agentPasswordConfirmation", app)
        self.assertIn("invalidate_detection", app)
        self.assertNotIn("Cancel", app)

    @unittest.skipUnless(shutil.which("node"), "Node.js is required")
    def test_node_version_matrix_matches_package_engine(self):
        checker = ROOT / "web-app" / "tools" / "check-node-version.mjs"
        expected = {
            "18.19.1": False,
            "20.18.0": False,
            "20.19.0": True,
            "21.7.3": False,
            "22.11.0": False,
            "22.12.0": True,
            "24.0.0": True,
        }
        for version, supported in expected.items():
            with self.subTest(version=version):
                result = subprocess.run(
                    ["node", str(checker), version],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                self.assertEqual(result.returncode == 0, supported)

        dashboard_package = json.loads((ROOT / "web-app" / "package.json").read_text())
        installer_package = json.loads((ROOT / "installer" / "package.json").read_text())
        expected_engine = "^20.19.0 || >=22.12.0"
        self.assertEqual(dashboard_package["engines"]["node"], expected_engine)
        self.assertEqual(installer_package["engines"]["node"], expected_engine)


if __name__ == "__main__":
    unittest.main()
