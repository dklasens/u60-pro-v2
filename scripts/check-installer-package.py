#!/usr/bin/env python3
"""Launch the packaged WebView and verified ADB without any modem interaction."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def check(app=None, windows_exe=None):
    version = json.loads((ROOT / 'installer/package.json').read_text())['version']
    if app:
        info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
        assert info['CFBundleShortVersionString'] == version
        assert info['LSMinimumSystemVersion'] == '15.0'
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
        if os.environ.get('APPLE_SIGNING_IDENTITY'):
            subprocess.run(['spctl', '--assess', '--type', 'execute', '--verbose', str(app)], check=True)
        executable = app / 'Contents/MacOS' / info['CFBundleExecutable']
        resources = app / 'Contents/Resources/platform-tools'
        platform = 'darwin'
    else:
        executable = windows_exe
        resources = executable.parent / 'platform-tools'
        platform = 'windows'
    lock = json.loads((ROOT / 'installer/platform-tools.lock.json').read_text())['platforms'][platform]
    actual = {str(p.relative_to(resources)).replace('\\', '/') for p in resources.rglob('*') if p.is_file()}
    assert actual == set(lock['files']), f'Unexpected ADB resources: {actual}'
    with tempfile.TemporaryDirectory(prefix='u60 startup check ') as work:
        report = Path(work) / 'startup.json'
        completed = subprocess.run([str(executable.resolve()), '--startup-check', str(report)], timeout=90, capture_output=True, text=True)
        if completed.returncode:
            raise RuntimeError(f'Packaged app exited {completed.returncode}: {completed.stderr[-2000:]}')
        data = json.loads(report.read_text())
        assert data == {'version': version, 'frontend': 'mounted', 'adb': 'verified and executable', 'modem_contacted': False, 'resource_directory': True}
    print(f'PASS: {platform} packaged UI startup, version, resource allowlist and executable ADB; no modem contacted')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--app', type=Path)
    source.add_argument('--windows-exe', type=Path)
    args = parser.parse_args()
    check(args.app, args.windows_exe)
