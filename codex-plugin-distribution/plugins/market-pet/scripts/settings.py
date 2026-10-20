#!/usr/bin/env python3
"""Read or atomically modify KuruPal settings, without requiring hooks."""
import argparse
import contextlib
import json
import re
import sys
import time
from bridge import app_dir, atomic_json


def validate(value):
    if not isinstance(value, dict) or value.get('size') not in ('small', 'medium', 'large'):
        raise ValueError('无效的桌宠大小配置')
    stocks = value.get('watchlist')
    if not isinstance(stocks, list) or len(stocks) > 5 or any(not isinstance(s, str) or not re.fullmatch(r'[0-9]{6}', s) for s in stocks):
        raise ValueError('请输入六位A股代码，最多关注5只股票')
    return value


def read(base):
    path = base / 'settings.json'
    if not path.exists():
        raise ValueError('请先启动 KuruPal 0.3.4 或更高版本一次，自动迁移现有设置后再重试')
    return validate(json.loads(path.read_text()))


def change(base, size=None, add=None, remove=None, replace=None):
    base.mkdir(parents=True, exist_ok=True)
    lock = base / 'settings.lock'
    deadline = time.monotonic() + 3
    while True:
        try:
            lock.mkdir()
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise ValueError('设置正在修改，请稍后重试；若持续失败，请检查 settings.lock 是否由已退出的进程遗留')
            time.sleep(.05)
    try:
        value = read(base)
        if size is not None:
            value['size'] = size
        if replace is not None:
            value['watchlist'] = list(dict.fromkeys(replace))
        if add is not None:
            value['watchlist'] = list(dict.fromkeys(value['watchlist'] + add))
        if remove is not None:
            value['watchlist'] = [s for s in value['watchlist'] if s not in remove]
        validate(value)
        atomic_json(base / 'settings.json', value)
        return value
    finally:
        lock.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--size', choices=('small', 'medium', 'large'))
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--add', nargs='+')
    group.add_argument('--remove', nargs='+')
    group.add_argument('--replace', nargs='*', help='Replace all stocks; no codes clears the list')
    args = parser.parse_args()
    try:
        for codes in (args.add, args.remove, args.replace):
            if codes is not None and any(not re.fullmatch(r'[0-9]{6}', s) for s in codes):
                raise ValueError('股票代码必须为六位数字，保留前导零')
        changed = any(v is not None for v in vars(args).values())
        value = change(app_dir(), **vars(args)) if changed else read(app_dir())
        print(json.dumps({'status':'saved' if changed else 'current', 'settings':value,
            'application':'运行中的新版桌宠将在约1秒内读取；未运行时下次启动生效。此结果仅确认配置文件。'}, ensure_ascii=False))
    except (OSError, ValueError) as exc:
        print(json.dumps({'status':'error','error':str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
