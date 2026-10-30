# Chạy: python3 netflix/tests/ui.test.py [đường-dẫn-alpine cdn.min.js]
# Giả lập API_URL, hiển thị 3 kết quả (mới / sắp hết hạn / quá hạn) trên điện thoại và máy tính.
import json, sys, pathlib, datetime as dt
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PAGE = (ROOT / 'index.html').as_uri()
ALPINE = sys.argv[1] if len(sys.argv) > 1 else None

def iso(min_ago):
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=min_ago)).isoformat()

ITEMS = [
    {'id': 'a', 'type': 'SIGNIN', 'title': 'Mã đăng nhập', 'code': '4821', 'at': iso(1)},
    {'id': 'b', 'type': 'TEMP', 'title': 'Mã truy cập tạm thời', 'link': 'https://www.netflix.com/account/travel/verify?nftoken=A', 'at': iso(12)},
    {'id': 'c', 'type': 'HOUSEHOLD', 'title': 'Cập nhật Hộ gia đình', 'link': 'https://www.netflix.com/account/update-primary-location?nftoken=B', 'at': iso(16)},
]
# Môi trường test không tải được CDN Tailwind: giả lập phần nền ảnh hưởng tới bố cục (preflight + khung trang).
TW_STUB = '''window.tailwind={}; document.head.insertAdjacentHTML('beforeend','<style>*,::before,::after{box-sizing:border-box;margin:0} main{max-width:36rem;margin:0 auto;padding:40px 16px 64px} .w-full{width:100%} .p-5{padding:20px} a{overflow-wrap:anywhere}</style>');'''
results, fails = [], 0
def check(name, cond):
    global fails
    print(('✓ ' if cond else '✗ ') + name); fails += 0 if cond else 1

def setup(page, responses):
    queue = list(responses)
    def api(route):
        body = queue.pop(0) if len(queue) > 1 else queue[0]
        route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
    page.route('**/script.google.com/**', api)
    page.route('**/cdn.tailwindcss.com/**', lambda r: r.fulfill(body=TW_STUB, content_type='text/javascript'))
    page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
    if ALPINE:
        page.route('**/alpinejs**', lambda r: r.fulfill(path=ALPINE, content_type='text/javascript'))
    page.goto(PAGE); page.wait_for_function('window.Alpine')
    page.click('button:has-text("dn.insights@gmail.com")'); page.wait_for_timeout(150)
    check('chọn 1 email → chỉ còn email đó + nút Đổi, email kia ẩn', page.is_visible('text=Đổi') and not page.is_visible('button:has-text("dnctab2024@gmail.com")') and page.evaluate("document.body._x_dataStack[0].email") == 'dn.insights@gmail.com')
    page.click('text=Đổi'); page.wait_for_timeout(150)
    check('bấm Đổi → hiện lại cả 2 email', page.is_visible('button:has-text("dnctab2024@gmail.com")') and page.is_visible('button:has-text("dn.insights@gmail.com")'))
    page.click('text=Email khác…')

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp in [('điện thoại', {'width': 390, 'height': 844}), ('máy tính', {'width': 1280, 'height': 900})]:
        page = b.new_page(viewport=vp)
        setup(page, [{'ok': True, 'needPin': False, 'windowMin': 20, 'items': ITEMS}])
        page.fill('#em', 'kh1@mail.com'); page.click('button[type=submit]')
        page.wait_for_selector('#results article >> nth=2')
        arts = page.locator('#results article')
        check(f'[{label}] hiện đủ 3 kết quả', arts.count() == 3)
        check(f'[{label}] mã đăng nhập hiện 4821', arts.nth(0).locator('.code').inner_text() == '4821')
        vis = lambda i, k: arts.nth(i).locator(f'[data-warn={k}]').is_visible()
        check(f'[{label}] kết quả 1 phút: không cảnh báo', not vis(0, 'soon') and not vis(0, 'expired'))
        check(f'[{label}] kết quả 12 phút: "sắp hết hạn", còn 3 phút', vis(1, 'soon') and not vis(1, 'expired') and 'còn 3 phút' in arts.nth(1).locator('[data-warn=soon]').inner_text())
        check(f'[{label}] kết quả 16 phút: "đã hết hạn"', vis(2, 'expired') and not vis(2, 'soon'))
        check(f'[{label}] nút link đúng loại', arts.nth(1).locator('a').get_attribute('href').endswith('nftoken=A') and 'Hộ gia đình' in arts.nth(2).locator('a').inner_text())
        check(f'[{label}] không tràn ngang', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        page.close()

    # mã khách + chờ email
    page = b.new_page(viewport={'width': 390, 'height': 844})
    setup(page, [{'ok': False, 'needPin': True, 'message': 'Nhập thêm mã khách shop gửi kèm tài khoản.'},
                 {'ok': True, 'needPin': True, 'windowMin': 20, 'items': []}])
    page.fill('#em', 'kh1@mail.com'); page.click('button[type=submit]')
    page.wait_for_selector('#pin', state='visible')
    check('cần mã khách → hiện ô mã khách + thông báo', 'mã khách' in page.locator('p.text-down').inner_text())
    page.fill('#pin', '012345'); page.click('button[type=submit]')
    page.wait_for_selector('text=Đang chờ email từ Netflix')
    check('chưa có email → tự chờ', True)
    page.close(); b.close()

print('\n' + ('TẤT CẢ ĐẠT' if not fails else f'{fails} LỖI'))
sys.exit(1 if fails else 0)
