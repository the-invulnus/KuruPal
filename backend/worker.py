"""One bounded snapshot per invocation; stdout is exclusively JSON."""
import contextlib
import json
import math
import re
import sys
from datetime import datetime, timezone

def normalize(symbol, frame):
    values = dict(zip(frame['item'], frame['value']))
    price, pct = float(values['最新']), float(values['涨幅'])
    if not math.isfinite(price) or not math.isfinite(pct) or price <= 0:
        raise ValueError('无有效报价，可能停牌或尚未开盘')
    return {'symbol': symbol, 'price': price, 'pct': pct,
            'fetchedAt': datetime.now(timezone.utc).isoformat(), 'source': 'AKShare / 东方财富'}

def main(symbols):
    if not 1 <= len(symbols) <= 5 or any(not re.fullmatch(r'\d{6}', s) for s in symbols):
        return {'quotes': [], 'errors': [{'symbol': '', 'error': '股票代码格式错误'}]}
    results, errors = [], []
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import akshare as ak
            import requests
            original = requests.sessions.Session.request
            def bounded(self, method, url, **kwargs):
                kwargs['timeout'] = (4, 8)
                return original(self, method, url, **kwargs)
            requests.sessions.Session.request = bounded
            for symbol in dict.fromkeys(symbols):
                try:
                    results.append(normalize(symbol, ak.stock_bid_ask_em(symbol=symbol)))
                except Exception as exc:
                    errors.append({'symbol': symbol, 'error': type(exc).__name__ + ': 行情暂不可用'})
    except Exception as exc:
        errors.append({'symbol': '', 'error': type(exc).__name__ + ': 采集器初始化失败'})
    return {'quotes': results, 'errors': errors}

if __name__ == '__main__':
    print(json.dumps(main(sys.argv[1:]), ensure_ascii=False, allow_nan=False))
