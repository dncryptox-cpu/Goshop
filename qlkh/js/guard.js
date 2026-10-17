// guard.js — trang sản phẩm (Netflix, ChatGPT…) chỉ mở được khi đã đăng nhập ở qlkh/index.html.
(function () {
    try {
        var s = JSON.parse(localStorage.getItem('qlkh_session') || 'null');
        if (s && s.username && Date.now() - s.ts < 7 * 86400000) return;
    } catch (e) {}
    location.replace('index.html#dashboard');
})();
