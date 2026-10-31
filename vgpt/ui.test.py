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
            elif len(calls) >= 5: r = {'ok': False, 'quotaOut': True, 'used': 3, 'quota': 3, 'message': 'Bạn đã dùng hết 3 lần lấy mã. Nhắn shop để được cấp thêm lượt nhé.'}
            else: r = {'ok': True, 'code': '0%05d' % (len(calls) * 111), 'secondsLeft': 30 if len(calls) == 3 else 3, 'name': 'Cafard', 'used': 1, 'quota': 3, 'sessionLeft': 4 if len(calls) == 3 else 180}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(r))
        pg.route('**/script.google.com/**', api)
        pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        if ALPINE: pg.route('**/alpinejs**', lambda r: r.fulfill(path=ALPINE, content_type='text/javascript'))
        pg.goto(PAGE); pg.wait_for_function('window.Alpine')
        check(f'[{label}] chọn sẵn email dncethxyz, ẩn ô gõ', pg.is_visible('.picked') and 'dncethxyz@gmail.com' in pg.inner_text('.picked') and not pg.is_visible('#em'))
        pg.click('.picked .link'); pg.wait_for_selector('.pick:visible'); check(f'[{label}] bấm Đổi → hiện danh sách + Email khác', pg.is_visible('.pick') and not pg.is_visible('.picked'))
        pg.click('.pick'); pg.fill('#pin', 'sai'); pg.click('button[type=submit]')
        pg.wait_for_selector('.err:visible')
        check(f'[{label}] sai mã khách → báo lỗi, không hiện mã', 'không đúng' in pg.inner_text('.err') and not pg.is_visible('#result'))
        pg.fill('#pin', 'KH-CAFARD-01'); pg.click('button[type=submit]'); pg.wait_for_selector('#result .code:visible')
        check(f'[{label}] hiện mã 6 số tách 3-3', pg.inner_text('.code').replace(' ', '') == '000222')
        check(f'[{label}] gửi đúng action', calls[-1] == {'action': 'gpt_totp', 'email': 'dncethxyz@gmail.com', 'pin': 'KH-CAFARD-01'})
        check(f'[{label}] chào tên khách', 'Cafard' in pg.inner_text('.who'))
        pg.wait_for_function("document.querySelector('.code').innerText.replace(' ','') !== '000222'", timeout=8000)
        check(f'[{label}] hết 30s tự lấy mã mới', pg.inner_text('.code').replace(' ', '') == '000333')
        check(f'[{label}] hiện lần 1/3 và thời gian còn lại', '1/3' in pg.inner_text('.who') and ':' in pg.inner_text('.who'))
        check(f'[{label}] cảnh báo mã sống 45–60 giây', '45–60 giây' in pg.inner_text('.warn'))
        check(f'[{label}] không tràn ngang', pg.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        pg.wait_for_selector('#result', state='hidden', timeout=9000)
        check(f'[{label}] hết phiên → ẩn mã, báo lần sau tính thêm lượt', 'tính thêm 1 lần' in pg.inner_text('form'))
        pg.click('button[type=submit]'); pg.wait_for_selector('#result .code:visible'); pg.click('button[type=submit]')
        pg.wait_for_selector('.err:visible')
        check(f'[{label}] hết lượt → báo nhắn shop, không hiện mã', 'hết 3 lần' in pg.inner_text('.err') and not pg.is_visible('#result'))
        pg.close()
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
    if ALPINE: pg.route('**/alpinejs**', lambda r: r.fulfill(path=ALPINE, content_type='text/javascript'))
    pg.goto(PAGE + '?ma=KH-CAFARD-01'); pg.wait_for_function('window.Alpine')
    check('link ?ma= điền sẵn mã khách + email', pg.input_value('#pin') == 'KH-CAFARD-01' and 'dncethxyz@gmail.com' in pg.inner_text('.picked'))
    pg.close()
    b.close()
print('\n' + ('TẤT CẢ ĐẠT' if not fails else f'{fails} LỖI')); sys.exit(1 if fails else 0)
