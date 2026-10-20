"""Prepare local test-distribution ZIPs; never uploads or installs anything."""
from pathlib import Path
import hashlib
import json
import plistlib
import shutil
import subprocess
import sys
import tempfile
import zipfile
from package_plugin import package_plugin

ROOT = Path(__file__).resolve().parents[1]

def run(*args):
    subprocess.run(args, check=True)

def main():
    if sys.platform != 'darwin':
        raise SystemExit('Run on macOS after npm run bundle -- --bundles app')
    version = json.loads((ROOT/'src-tauri/tauri.conf.json').read_text())['version']
    source = ROOT/'src-tauri/target/release/bundle/macos/KuruPal.app'
    info = plistlib.loads((source/'Contents/Info.plist').read_bytes())
    if info['CFBundleShortVersionString'] != version:
        raise SystemExit('App version differs from source; rebuild first')
    executable = source/'Contents/MacOS'/info['CFBundleExecutable']
    arch = subprocess.check_output(['lipo','-archs',str(executable)],text=True).strip()
    if arch != 'arm64':
        raise SystemExit(f'Expected arm64 app, got {arch}')
    output = ROOT/'releases/prepared'
    output.mkdir(parents=True, exist_ok=True)
    name = f'KuruPal-{version}-macOS-arm64'
    archive = output/(name+'.zip')
    with tempfile.TemporaryDirectory(prefix='kurupal-package-') as temp:
        folder = Path(temp)/name
        folder.mkdir()
        app = folder/'KuruPal.app'
        run('ditto', str(source), str(app))
        # Only the staged copy is signed. No Developer ID / notarization claim.
        run('codesign','--force','--sign','-',str(app/'Contents/MacOS/market-data'))
        run('codesign','--force','--sign','-',str(app))
        run('codesign','--verify','--deep','--strict',str(app))
        shutil.copy2(ROOT/'docs/MACOS_INSTALL.md',folder/'INSTALL.md')
        run('ditto','-c','-k','--norsrc','--keepParent',str(folder),str(archive))
        # Check the distributable after extraction, including executable bits/signatures.
        extracted = Path(temp)/'verify'
        run('ditto','-x','-k',str(archive),str(extracted))
        run('codesign','--verify','--deep','--strict',str(extracted/name/'KuruPal.app'))
    installer = package_plugin(output)
    for file in (archive,installer):
        with zipfile.ZipFile(file) as z:
            if z.testzip() is not None: raise SystemExit(f'Corrupt archive: {file}')
    checksums = ''.join(f'{hashlib.file_digest(file.open("rb"), "sha256").hexdigest()}  {file.name}\n' for file in (archive,installer))
    (output/'SHA256SUMS.txt').write_text(checksums)
    shutil.copy2(ROOT/'docs/MACOS_INSTALL.md',output/'INSTALL.md')
    print(f'Prepared {archive.name}, {installer.name}, SHA256SUMS.txt in {output}')

if __name__ == '__main__': main()
