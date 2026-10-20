"""Build the self-contained Codex installer without rebuilding the desktop app."""
from pathlib import Path
import argparse
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def package_plugin(output):
    distribution = ROOT / 'codex-plugin-distribution'
    plugin = distribution / 'plugins/kurupal'
    manifest = json.loads((plugin / '.codex-plugin/plugin.json').read_text())
    marketplace = json.loads((distribution / '.agents/plugins/marketplace.json').read_text())
    if manifest['name'] != 'kurupal' or marketplace['name'] != 'kurupal':
        raise ValueError('Plugin and marketplace must both be named kurupal')
    name = f'KuruPal-Codex-Installer-{manifest["version"]}'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'{name}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for file in sorted(distribution.rglob('*')):
            if '__pycache__' in file.parts or file.name == '.DS_Store':
                continue
            if file.is_symlink():
                raise ValueError(f'Symlink is not allowed in the installer: {file}')
            if file.is_file():
                z.write(file, Path(name) / file.relative_to(distribution))
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError(f'Corrupt archive: {archive}')
        for required in (
            'install.command', '.agents/plugins/marketplace.json',
            'plugins/kurupal/.codex-plugin/plugin.json',
            'plugins/kurupal/scripts/bridge.py',
            'plugins/kurupal/scripts/settings.py',
            'plugins/kurupal/hooks/hooks.json',
            'plugins/kurupal/skills/kurupal/SKILL.md',
            'plugins/kurupal/assets/avatar.png',
        ):
            z.getinfo(f'{name}/{required}')
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'releases/prepared')
    print(package_plugin(parser.parse_args().output))
