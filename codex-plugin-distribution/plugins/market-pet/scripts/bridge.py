#!/usr/bin/env python3
"""Local-only Codex event adapter. Never reads transcripts or returns decisions."""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
import uuid

EVENTS = {'task_started', 'working', 'waiting_for_user', 'task_succeeded', 'task_failed', 'task_cancelled'}

def app_dir():
    if sys.platform == 'darwin':
        return Path.home() / 'Library/Application Support/studio.marketpet.desktop'
    if sys.platform == 'win32':
        return Path(os.environ.get('APPDATA', Path.home() / 'AppData/Roaming')) / 'studio.marketpet.desktop'
    return Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')) / 'studio.marketpet.desktop'

def failed(response):
    if isinstance(response, dict):
        if response.get('isError') is True or response.get('is_error') is True:
            return True
        for key in ('exit_code', 'exitCode'):
            value = response.get(key)
            if isinstance(value, int) and not isinstance(value, bool) and value != 0:
                return True
        return False
    # Shell model-facing wrappers, not free-form command output or prose.
    if isinstance(response, str):
        match = re.search(r'^Process exited with code (-?\d+)\s*$', response, re.M)
        return bool(match and int(match.group(1)) != 0)
    return False

def reaction(payload):
    event = payload.get('hook_event_name')
    if event == 'UserPromptSubmit': return {'event': 'task_started'}
    if event == 'PermissionRequest': return {'event': 'waiting_for_user'}
    if event == 'Interrupt': return {'event': 'task_cancelled'}
    if event == 'PreToolUse':
        tool = payload.get('tool_name', '')
        if tool.split('.')[-1] in ('request_user_input', 'request_user_input_async'):
            return {'event': 'waiting_for_user'}
        return {'event': 'working'}
    if event == 'PostToolUse' and failed(payload.get('tool_response')):
        return {'event': 'task_failed'}
    if event == 'Stop' and not payload.get('stop_hook_active'):
        # A completed model turn does not prove task success.
        return {'action': 'idle'}
    return None

def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.pending-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, ensure_ascii=False)
        os.replace(name, path)
    finally:
        with contextlib.suppress(FileNotFoundError): os.unlink(name)

def audit(root, data):
    path = root / 'bridge.jsonl'
    if path.exists() and path.stat().st_size > 512_000:
        os.replace(path, root / 'bridge.previous.jsonl')
    with path.open('a') as stream:
        stream.write(json.dumps({'timestampMs': int(time.time()*1000), **data})+'\n')

def deliver(payload, selected=None, base=None, data_dir=None):
    now = time.time()
    base = base or app_dir()
    root = data_dir or Path(os.environ.get('PLUGIN_DATA', str(base / 'codex-plugin')))
    root.mkdir(parents=True, exist_ok=True)
    chosen = selected or reaction(payload)
    if not chosen: return False
    # No prompt, command, tool output, transcript, or raw session identifier is stored.
    session = hashlib.sha256(str(payload.get('session_id', 'manual')).encode()).hexdigest()[:24]
    state_path = root / (session+'.json')
    try: state = json.loads(state_path.read_text())
    except (OSError, ValueError): state = {}
    if chosen.get('event') == 'working' and now-state.get('workingAt', 0) < 30:
        return False
    if chosen.get('event') == 'working': state['workingAt'] = now
    inbox = base / 'hooks'
    inbox.mkdir(parents=True, exist_ok=True)
    for old in inbox.glob('codex-*.json'):
        with contextlib.suppress(OSError):
            if now-old.stat().st_mtime > 60: old.unlink()
    if len(list(inbox.glob('codex-*.json'))) >= 256:
        audit(root, {'status':'inbox_full', 'hook':payload.get('hook_event_name')})
        return False
    target = inbox / ('codex-'+str(time.time_ns())+'-'+uuid.uuid4().hex+'.json')
    atomic_json(target, {**chosen, 'createdAt':int(now*1000)})
    atomic_json(state_path, state)
    audit(root, {'status':'delivered', 'hook':payload.get('hook_event_name','manual'), **chosen})
    return True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--event', choices=sorted(EVENTS))
    parser.add_argument('--status', action='store_true')
    args = parser.parse_args()
    if args.status:
        print(json.dumps({'inbox':str(app_dir()/'hooks'), 'pluginData':os.environ.get('PLUGIN_DATA',str(app_dir()/'codex-plugin')), 'python':sys.version.split()[0]},ensure_ascii=False))
        return
    try:
        if args.event:
            deliver({}, {'event':args.event})
        else:
            raw = sys.stdin.read(2_000_001)
            if len(raw)>2_000_000: return
            payload=json.loads(raw)
            if isinstance(payload,dict): deliver(payload)
    except Exception:
        # Cosmetic integration must not block a Codex operation.
        pass
    if not args.event: print('{}')

if __name__ == '__main__': main()
