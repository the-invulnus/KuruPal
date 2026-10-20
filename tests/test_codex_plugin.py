import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
PLUGIN=ROOT/'codex-plugin-distribution/plugins/kurupal'
spec=importlib.util.spec_from_file_location('bridge',PLUGIN/'scripts/bridge.py')
bridge=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

class BridgeTests(unittest.TestCase):
 def test_mapping(self):
  for hook,event in [('UserPromptSubmit','task_started'),('PermissionRequest','waiting_for_user'),('Interrupt','task_cancelled')]:
   self.assertEqual(bridge.reaction({'hook_event_name':hook}),{'event':event})
  self.assertEqual(bridge.reaction({'hook_event_name':'Stop'}),{'action':'idle'})
  self.assertIsNone(bridge.reaction({'hook_event_name':'Stop','stop_hook_active':True}))
 def test_errors(self):
  for response in [{'exit_code':1},{'exitCode':2},{'isError':True},'Process exited with code 3\nOutput:\n...']:
   self.assertEqual(bridge.reaction({'hook_event_name':'PostToolUse','tool_response':response}),{'event':'task_failed'})
  for response in [{'exit_code':0},{'exit_code':None},{'content':[{'text':'error handling succeeded'}]},'error in source code']:
   self.assertIsNone(bridge.reaction({'hook_event_name':'PostToolUse','tool_response':response}))
 def test_delivery_and_throttle(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);base=root/'app';data=root/'plugin'
   payload={'hook_event_name':'PreToolUse','session_id':'private-session','prompt':'secret','transcript_path':'/do/not/read'}
   self.assertTrue(bridge.deliver(payload,base=base,data_dir=data))
   self.assertFalse(bridge.deliver(payload,base=base,data_dir=data))
   payload.update(hook_event_name='PostToolUse',tool_response={'exit_code':1})
   self.assertTrue(bridge.deliver(payload,base=base,data_dir=data))
   self.assertTrue(bridge.deliver(payload,base=base,data_dir=data))
   messages=[json.loads(p.read_text()) for p in (base/'hooks').glob('*.json')]
   self.assertEqual(len(messages),3)
   self.assertTrue(all(set(m)=={'event','createdAt'} for m in messages))
   logs=(data/'bridge.jsonl').read_text()
   self.assertNotIn('secret',logs);self.assertNotIn('private-session',logs)
 def test_manifest_and_hooks(self):
  manifest=json.loads((PLUGIN/'.codex-plugin/plugin.json').read_text())
  self.assertEqual(manifest['name'],'kurupal')
  marketplace=json.loads((ROOT/'codex-plugin-distribution/.agents/plugins/marketplace.json').read_text())
  self.assertEqual(marketplace['name'],'kurupal')
  entry=marketplace['plugins'][0]
  self.assertEqual(entry['name'],manifest['name'])
  self.assertEqual((ROOT/'codex-plugin-distribution'/entry['source']['path']).resolve(),PLUGIN)
  skill=PLUGIN/'skills/kurupal/SKILL.md'
  self.assertIn('\nname: kurupal\n',skill.read_text())
  self.assertTrue((skill.parent/'../../scripts/settings.py').resolve().is_file())
  self.assertTrue((skill.parent/'../../scripts/bridge.py').resolve().is_file())
  hooks=json.loads((PLUGIN/'hooks/hooks.json').read_text())['hooks']
  self.assertEqual(set(hooks),{'UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','Stop','Interrupt'})
  for event,groups in hooks.items():
   self.assertEqual(groups[0]['hooks'][0]['timeout'],3)
 def test_bad_input_does_not_block(self):
  r=subprocess.run(['python3',str(PLUGIN/'scripts/bridge.py')],input='bad json',text=True,capture_output=True)
  self.assertEqual(r.returncode,0);self.assertEqual(json.loads(r.stdout),{})

if __name__=='__main__':unittest.main()
