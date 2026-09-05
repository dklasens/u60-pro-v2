#!/usr/bin/env python3
"""Keep release versions aligned and local-only artifacts out of the Git tree."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    versions = {}
    for name in ['agent/Cargo.toml', 'installer/src-tauri/Cargo.toml']:
        versions[name] = re.search(r'^version = "([^"]+)"', (ROOT / name).read_text(), re.M)[1]
    for name in ['web-app/package.json', 'installer/package.json', 'installer/src-tauri/tauri.conf.json']:
        versions[name] = json.loads((ROOT / name).read_text())['version']
    for name in ['web-app/package-lock.json', 'installer/package-lock.json']:
        lock = json.loads((ROOT / name).read_text())
        versions[name] = lock['version']
        versions[name + ' root package'] = lock['packages']['']['version']
    assert len(set(versions.values())) == 1, f'Release versions disagree: {versions}'
    version = next(iter(versions.values()))
    ref = os.environ.get('RELEASE_SOURCE_REF') or os.environ.get('GITHUB_REF', '')
    if re.fullmatch(r'v\d+\.\d+(?:\.\d+)?', ref):
        ref = 'refs/tags/' + ref
    if ref.startswith('refs/tags/v'):
        tag_version = ref.removeprefix('refs/tags/v')
        if re.fullmatch(r'\d+\.\d+', tag_version):
            tag_version += '.0'
        assert tag_version == version, 'Tag and package versions disagree'

    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    failures = []
    for name in filter(None, tracked):
        path = Path(name)
        parts = [p.lower() for p in path.parts]
        if (any(p in {'node_modules', 'target', 'dist', 'build', 'firmware', 'venv', 'env', '__pycache__'}
                or p.startswith('.venv') for p in parts)
            or path.suffix.lower() in {'.qcow2', '.vmdk', '.vdi', '.pyc', '.pyo'}
            or path.name.startswith(('.env', 'back_parameter'))
            or path.name in {'dashboard-access.json', 'deployment-result.json', 'adb-lock-investigation.md',
                             'device_report.json', 'ubus_probe_report.json'}
            or name.startswith(('scripts/emulat', 'scripts/test-emulator-', 'installer/assets/platform-tools/'))
            or name == 'docs/EMULATION.md'):
            failures.append(name)
    assert not failures, 'Local-only artifacts in Git: ' + ', '.join(failures)
    print(f'OK: versions aligned at {version}; Git tree excludes local environments, emulators and recovery data')


if __name__ == '__main__':
    main()
