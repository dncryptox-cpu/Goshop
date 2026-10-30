# Chạy: python3 vgpt/ui.test.py [đường-dẫn alpine cdn.min.js]
import json, sys, pathlib
from playwright.sync_api import sync_playwright
PAGE = (pathlib.Path(__file__).resolve().parent / 'index.html').as_uri()
ALPINE = sys.argv[1] if len(sys.argv) > 1 else None
fails = 0
def check(n, c):
    global fails; print(('✓ ' if c else '✗ ') + n); fails += 0 if c else 1
with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp in [('điện thoại', {'width': 390, 'height': 844}), ('máy tính', {'width': 1280, 'height': 900})]:
        pg = b.new_page(viewport=vp); calls = []
        def api(route):
            body = json.loads(route.request.post_data); calls.append(body)
            if body['pin'] != 'KH-CAFARD-01': r = {'ok': False, 'message': 'Mã khách không đúng.'}
            else: r = {'ok': True, 'code': '0%05d' % (len(calls) * 111), 'secondsLeft': 3, 'name': 'Cafard'}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(r))
        pg.route('**/script.google.com/**', api)
        pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        if ALPINE: pg.route('**/alpinejs**', lambda r: r.fulfill(path=ALPINE, content_type='text/javascript'))
        pg.goto(PAGE); pg.wait_for_function('window.Alpine')
        pg.fill('#em', 'dncethxyz@gmail.com'); pg.fill('#pin', 'sai'); pg.click('button[type=submit]')
        pg.wait_for_selector('.err:visible')
        check(f'[{label}] sai mã khách → báo lỗi, không hiện mã', 'không đúng' in pg.inner_text('.err') and not pg.is_visible('#result'))
        pg.fill('#pin', 'KH-CAFARD-01'); pg.click('button[type=submit]'); pg.wait_for_selector('#result .code:visible')
        check(f'[{label}] hiện mã 6 số tách 3-3', pg.inner_text('.code').replace(' ', '') == '000222')
        check(f'[{label}] gửi đúng action', calls[-1] == {'action': 'gpt_totp', 'email': 'dncethxyz@gmail.com', 'pin': 'KH-CAFARD-01'})
        check(f'[{label}] chào tên khách', 'Cafard' in pg.inner_text('.who'))
        pg.wait_for_function("document.querySelector('.code').innerText.replace(' ','') !== '000222'", timeout=8000)
        check(f'[{label}] hết 30s tự lấy mã mới', pg.inner_text('.code').replace(' ', '') == '000333')
        check(f'[{label}] không tràn ngang', pg.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        pg.screenshot(path=f'/tmp/claude-0/vgpt-{vp["width"]}.png', full_page=True); pg.close()
    b.close()
print('\n' + ('TẤT CẢ ĐẠT' if not fails else f'{fails} LỖI')); sys.exit(1 if fails else 0)
