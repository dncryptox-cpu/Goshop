/* Nút Quay lại / Tải lại cho app mở từ màn hình chính iPhone (không có thanh Safari).
   Chỉ hiện khi chạy dạng app (standalone), không hiện trong trình duyệt thường hay trong iframe.
   Kéo lên/xuống để đổi chỗ, nhớ vị trí trên máy. */
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  var standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!standalone || document.getElementById('dnc-appnav')) return;

  var KEY = 'dnc.appnav.y';
  function getY() { try { var v = parseFloat(localStorage.getItem(KEY)); return isNaN(v) ? 0.62 : v; } catch (e) { return 0.62; } }
  function setY(v) { try { localStorage.setItem(KEY, String(v)); } catch (e) {} }

  var css = '' +
    '#dnc-appnav{position:fixed;left:0;z-index:2147483000;display:flex;flex-direction:column;' +
    'padding:3px 3px 3px calc(3px + env(safe-area-inset-left));border-radius:0 12px 12px 0;' +
    'background:rgba(15,23,42,.78);border:1px solid rgba(255,255,255,.12);border-left:0;' +
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);touch-action:none;' +
    '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;transform:translateY(-50%)}' +
    '#dnc-appnav button{all:unset;box-sizing:border-box;width:34px;height:38px;display:grid;place-items:center;' +
    'color:#fff;border-radius:9px;cursor:pointer}' +
    '#dnc-appnav button:active{background:rgba(255,255,255,.16)}' +
    '#dnc-appnav button[aria-disabled="true"]{opacity:.35}' +
    '#dnc-appnav i{display:block;height:1px;margin:0 7px;background:rgba(255,255,255,.16)}' +
    '#dnc-appnav svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#dnc-appnav.spin .rl svg{animation:dncspin .7s linear infinite}' +
    '@keyframes dncspin{to{transform:rotate(360deg)}}' +
    '@media print{#dnc-appnav{display:none}}';

  function mount() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var el = document.createElement('div'); el.id = 'dnc-appnav'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Điều hướng');
    el.innerHTML =
      '<button type="button" class="bk" aria-label="Quay lại"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><i></i>' +
      '<button type="button" class="rl" aria-label="Tải lại"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button>';
    document.body.appendChild(el);
    var bk = el.querySelector('.bk'), rl = el.querySelector('.rl');

    function place(f) { f = Math.min(0.9, Math.max(0.1, f)); el.style.top = (f * 100) + '%'; return f; }
    var y = place(getY());
    function canBack() { return history.length > 1; }
    function sync() { bk.setAttribute('aria-disabled', canBack() ? 'false' : 'true'); }
    sync();
    ['popstate', 'hashchange', 'pageshow'].forEach(function (t) { window.addEventListener(t, sync); });
    setInterval(sync, 1500);

    // kéo để đổi chỗ; chạm nhẹ = bấm nút
    var drag = null, moved = false;
    el.addEventListener('pointerdown', function (e) { drag = { y0: e.clientY, f0: y }; moved = false; });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return; var dy = e.clientY - drag.y0;
      if (!moved && Math.abs(dy) < 8) return; moved = true;
      y = place(drag.f0 + dy / window.innerHeight);
    });
    function end() { if (drag && moved) setY(y); drag = null; }
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);

    bk.addEventListener('click', function () { if (moved) return; if (canBack()) history.back(); });
    rl.addEventListener('click', function () { if (moved) return; el.classList.add('spin'); location.reload(); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
