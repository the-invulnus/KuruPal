"""Check migration guards without changing the user's Codex installation."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

INSTALLER = Path(__file__).resolve().parents[1] / 'codex-plugin-distribution/install.command'


class InstallTests(unittest.TestCase):
    def run_installer(self, installed):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            cli = root / 'codex'
            cli.write_text(f'''#!{sys.executable}
import json, os, sys
from pathlib import Path
with Path(os.environ['TEST_CLI_LOG']).open('a') as log:
    log.write(json.dumps(sys.argv[1:]) + '\\n')
if sys.argv[1:3] == ['plugin', 'list']:
    print(os.environ['TEST_INSTALLED'])
''')
            cli.chmod(0o755)
            log = root / 'calls.jsonl'
            result = subprocess.run(
                ['/bin/sh', str(INSTALLER)], capture_output=True, text=True,
                env={**os.environ, 'PATH':f'{root}:{os.environ["PATH"]}',
                     'TEST_INSTALLED':json.dumps({'installed':installed}),
                     'TEST_CLI_LOG':str(log)},
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            return result, calls

    def test_fresh_install_uses_new_identity(self):
        result, calls = self.run_installer([])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[-1], ['plugin', 'add', 'kurupal@kurupal'])
        self.assertIn('无需重启', result.stdout)

    def test_active_legacy_stops_before_any_mutation(self):
        result, calls = self.run_installer([
            {'pluginId':'market-pet@market-pet-local', 'enabled':True},
        ])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('停用旧版', result.stderr)
        self.assertEqual(len(calls), 1)

    def test_disabled_legacy_keeps_cache_and_can_install(self):
        result, calls = self.run_installer([
            {'pluginId':'market-pet@market-pet-local', 'enabled':False},
        ])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[-1], ['plugin', 'add', 'kurupal@kurupal'])
        self.assertFalse(any('remove' in call for call in calls))

    def test_unknown_legacy_state_also_stops(self):
        result, calls = self.run_installer([
            {'pluginId':'market-pet@market-pet-local'},
        ])
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
