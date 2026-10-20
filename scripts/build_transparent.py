"""Build portable RGBA atlases from the approved VP9 Alpha sources."""
from pathlib import Path
import argparse, json, subprocess
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = root / 'assets/transparent'
out = root / 'public-app/kurumi'
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((source / 'manifest.json').read_text())
manifest['name'] = '久留美 · 透明桌宠'
parser = argparse.ArgumentParser()
parser.add_argument('--action', action='append', help='Rebuild only this action; repeatable')
selected = parser.parse_args().action
if selected:
    assert all(action in manifest['actions'] for action in selected), 'Unknown action'
    previous = json.loads((out / 'manifest.json').read_text())

for action, clip in manifest['actions'].items():
    if selected and action not in selected:
        manifest['actions'][action] = previous['actions'][action]
        continue
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', str(source / clip['src']), '-vf', 'scale=320:320:flags=lanczos', '-pix_fmt', 'rgba', '-f', 'rawvideo', '-'])
    size = 320 * 320 * 4
    assert len(raw) % size == 0
    frames = len(raw) // size
    atlas = Image.new('RGBA', (320 * 10, 320 * ((frames + 9) // 10)))
    for i in range(frames):
        frame = Image.frombytes('RGBA', (320, 320), raw[i*size:(i+1)*size])
        low, high = frame.getchannel('A').getextrema()
        assert high >= 200, (action, i, low, high)
        atlas.paste(frame, ((i % 10)*320, (i // 10)*320))
    assert atlas.getchannel('A').getextrema() == (0, 255)
    filename = Path(clip['src']).stem + '.png'
    atlas.save(out / filename, optimize=True)
    manifest['actions'][action] = dict(type='sprite', src=filename, frameWidth=320, frameHeight=320, columns=10, frames=frames, fps=24, loop=action=='idle')
    print(action, frames, (out / filename).stat().st_size, flush=True)
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
