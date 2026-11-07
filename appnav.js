/* Nút Quay lại / Tải lại cho app mở từ màn hình chính iPhone (không có thanh Safari).
   Chỉ hiện khi chạy dạng app (standalone), không hiện trong trình duyệt thường hay trong iframe.
   Viên nhỏ góc phải dưới, tự đổi màu theo nền trang. Kéo lên/xuống để đổi chỗ. */
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  var standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!standalone || document.getElementById('dnc-appnav')) return;

  var KEY = 'dnc.appnav.b';   // khoảng cách tới đáy (px), nhớ trên máy
  function getB() { try { var v = parseFloat(localStorage.getItem(KEY)); return isNaN(v) ? 84 : v; } catch (e) { return 84; } }
  function setB(v) { try { localStorage.setItem(KEY, String(v)); } catch (e) {} }

  var css = '' +
    '#dnc-appnav{position:fixed;right:calc(12px + env(safe-area-inset-right));z-index:2147483000;display:flex;align-items:center;' +
    'height:30px;padding:0 2px;border-radius:15px;background:rgba(255,255,255,.72);color:#0F172A;' +
    'box-shadow:0 0 0 .5px rgba(15,23,42,.14),0 2px 8px rgba(15,23,42,.10);' +
    '-webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);touch-action:none;' +
    '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .2s}' +
    '#dnc-appnav.dk{background:rgba(28,31,38,.72);color:#F1F5F9;box-shadow:0 0 0 .5px rgba(255,255,255,.14),0 2px 10px rgba(0,0,0,.4)}' +
    '#dnc-appnav button{all:unset;box-sizing:border-box;width:32px;height:30px;display:grid;place-items:center;cursor:pointer;border-radius:13px}' +
    '#dnc-appnav button:active{opacity:.45}' +
    '#dnc-appnav button[aria-disabled="true"]{opacity:.3}' +
    '#dnc-appnav i{width:.5px;height:14px;background:currentColor;opacity:.22}' +
    '#dnc-appnav svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#dnc-appnav.spin .rl svg{animation:dncspin .7s linear infinite}' +
    '@keyframes dncspin{to{transform:rotate(360deg)}}' +
    '@media print{#dnc-appnav{display:none}}';

  function isDark() {
    var el = document.body, c = '';
    while (el) { c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) break; el = el === document.body ? document.documentElement : null; }
    var m = (c || '').match(/\d+(\.\d+)?/g); if (!m) return window.matchMedia('(prefers-color-scheme: dark)').matches;
    return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
  }

  function mount() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var el = document.createElement('div'); el.id = 'dnc-appnav'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Điều hướng');
    el.innerHTML =
      '<button type="button" class="bk" aria-label="Quay lại"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><i></i>' +
      '<button type="button" class="rl" aria-label="Tải lại"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg></button>';
    document.body.appendChild(el);
    var bk = el.querySelector('.bk'), rl = el.querySelector('.rl');

    function place(v) { v = Math.min(window.innerHeight - 60, Math.max(12, v)); el.style.bottom = 'calc(' + v + 'px + env(safe-area-inset-bottom))'; return v; }
    var bot = place(getB());
    function canBack() { return history.length > 1; }
    function sync() { bk.setAttribute('aria-disabled', canBack() ? 'false' : 'true'); el.classList.toggle('dk', isDark()); }
    sync();
    ['popstate', 'hashchange', 'pageshow'].forEach(function (t) { window.addEventListener(t, sync); });
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    setInterval(sync, 2000);

    // kéo lên/xuống để đổi chỗ; chạm nhẹ = bấm
    var drag = null, moved = false;
    el.addEventListener('pointerdown', function (e) { drag = { y0: e.clientY, b0: bot }; moved = false; });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return; var dy = e.clientY - drag.y0;
      if (!moved && Math.abs(dy) < 8) return; moved = true;
      bot = place(drag.b0 - dy);
    });
    function end() { if (drag && moved) setB(bot); drag = null; }
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);

    bk.addEventListener('click', function () { if (moved) return; if (canBack()) history.back(); });
    rl.addEventListener('click', function () { if (moved) return; el.classList.add('spin'); location.reload(); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
