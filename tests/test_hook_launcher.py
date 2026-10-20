"""Execute the exact distributed command, including a removed plugin directory."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

PLUGIN = Path(__file__).resolve().parents[1] / 'codex-plugin-distribution/plugins/market-pet'
HOOKS = json.loads((PLUGIN/'hooks/hooks.json').read_text())['hooks']
COMMAND = HOOKS['PreToolUse'][0]['hooks'][0]['command']

class LauncherTests(unittest.TestCase):
    def run_hook(self, root, payload='{}', path=None):
        env = {**os.environ, 'PLUGIN_ROOT':str(root), 'HOME':str(root/'home'), 'PLUGIN_DATA':str(root/'data')}
        if path is not None: env['PATH'] = path
        result = subprocess.run(['/bin/sh','-c',COMMAND],input=payload,text=True,capture_output=True,env=env,timeout=4)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(result.stdout,'')
        self.assertEqual(result.stderr,'')
        return result

    def write_script(self, root, text):
        file = root/'scripts/bridge.py'
        file.parent.mkdir(parents=True,exist_ok=True)
        file.write_text(text)
        return file

    def test_every_event_has_same_protection(self):
        for groups in HOOKS.values():
            self.assertEqual(groups[0]['hooks'][0]['command'],COMMAND)
            self.assertGreater(groups[0]['hooks'][0]['timeout'],1)

    def test_entire_old_cache_directory_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            self.run_hook(Path(temp)/'deleted old version')

    def test_python_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);self.write_script(root,'raise RuntimeError()')
            self.run_hook(root,path='/nonexistent-kurupal-bin')

    def test_errors_and_blocking_output_are_isolated(self):
        scripts = [
            'this is not valid Python !!!',
            'raise PermissionError("inbox unavailable")',
            'import sys; print("deny",file=sys.stderr); sys.exit(2)',
            'print(\'{"decision":"block","reason":"never forward this"}\')',
        ]
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for script in scripts:
                with self.subTest(script=script):
                    self.write_script(root,script);self.run_hook(root)

    def test_stuck_script_is_terminated_before_host_timeout(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);self.write_script(root,'import time; time.sleep(60)')
            started=time.monotonic();self.run_hook(root)
            self.assertLess(time.monotonic()-started,2.5)

    def test_healthy_bridge_still_receives_event(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'path with spaces';self.write_script(root,(PLUGIN/'scripts/bridge.py').read_text())
            self.run_hook(root,json.dumps({'hook_event_name':'UserPromptSubmit'}))
            messages=list((root/'home/Library/Application Support/studio.marketpet.desktop/hooks').glob('*.json'))
            if os.sys.platform!='darwin':
                messages=list((root/'home/.local/share/studio.marketpet.desktop/hooks').glob('*.json'))
            self.assertEqual(len(messages),1)
            self.assertEqual(json.loads(messages[0].read_text())['event'],'task_started')

if __name__=='__main__':unittest.main()
