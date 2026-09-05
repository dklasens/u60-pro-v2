#!/usr/bin/env python3
"""Fetch pinned Google ADB and package only the required files and notices."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def prepare(platform, archive=None, destination=None):
    lock = json.loads((ROOT / 'installer/platform-tools.lock.json').read_text())
    spec = lock['platforms'][platform]
    destination = destination or ROOT / 'installer/assets/platform-tools'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='u60-adb-') as download:
        if archive is None:
            archive = Path(download) / 'platform-tools.zip'
            with urllib.request.urlopen(spec['url'], timeout=120) as response, archive.open('wb') as output:
                shutil.copyfileobj(response, output)
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == spec['sha256'], 'platform-tools archive checksum mismatch'
        with tempfile.TemporaryDirectory(prefix='.adb-stage-', dir=destination.parent) as temp:
            stage = Path(temp) / 'platform-tools'
            stage.mkdir()
            with zipfile.ZipFile(archive) as source:
                for name, digest in spec['files'].items():
                    data = source.read('platform-tools/' + name)
                    assert hashlib.sha256(data).hexdigest() == digest, f'ADB file checksum mismatch: {name}'
                    path = stage / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(data)
                    path.chmod(0o755 if name == 'adb' else 0o644)
            if destination.exists():
                destination.rename(Path(temp) / 'previous-tools')
            stage.rename(destination)
    print(f'Prepared ADB {lock["version"]} for {platform}: {len(spec["files"])} verified files')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('platform', choices=['darwin', 'windows'])
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    prepare(args.platform, args.archive)
