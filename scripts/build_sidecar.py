"""Run with the Python environment containing backend/requirements.txt."""
import pathlib, subprocess, sys, shutil
root = pathlib.Path(__file__).resolve().parents[1]
triple = subprocess.check_output(['rustc', '--print', 'host-tuple'], text=True).strip()
subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile',
    '--name', 'market-data', '--collect-data', 'akshare',
    '--distpath', str(root/'work/sidecar'), '--workpath', str(root/'work/pyinstaller'),
    '--specpath', str(root/'work'), str(root/'backend/worker.py')], check=True)
ext = '.exe' if sys.platform == 'win32' else ''
(root/'src-tauri/binaries').mkdir(parents=True, exist_ok=True)
shutil.copy2(root/f'work/sidecar/market-data{ext}', root/f'src-tauri/binaries/market-data-{triple}{ext}')
