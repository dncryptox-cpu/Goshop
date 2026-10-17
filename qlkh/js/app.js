// app.js — gộp các module thành 1 component Alpine. Nạp file này TRƯỚC các module.
(function () {
    const parts = [];
    const QLKH = window.QLKH = {
        // Mỗi module gọi QLKH.define(tên, {...state & methods}).
        define(name, obj) { parts.push({ name, obj }); },

        // Gộp bằng property descriptor để giữ nguyên getter/setter (spread {...} sẽ làm mất getter).
        build() {
            const target = {};
            const owner = {};
            for (const { name, obj } of parts) {
                for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(obj))) {
                    if (owner[key] && owner[key] !== name) console.warn(`[QLKH] "${key}" ở ${name} ghi đè ${owner[key]}`);
                    owner[key] = name;
                    Object.defineProperty(target, key, desc);
                }
            }
            return target;
        },

        // Lucide: gom nhiều lần gọi trong cùng một khung hình thành 1 lần quét.
        _iconQueued: false,
        icons() {
            if (QLKH._iconQueued || !window.lucide) return;
            QLKH._iconQueued = true;
            requestAnimationFrame(() => {
                QLKH._iconQueued = false;
                window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
            });
        }
    };

    window._rawDb = { APP_DATA: [], UPSALE: [], STOCK: [], PNL: [], Spot: [], DATA_YTB: [] };

    // Alpine gọi app() cho <body x-data="app()">.
    window.app = () => QLKH.build();

    // Tự vẽ icon cho phần tử mới do Alpine render (x-if / x-for) — không cần gọi tay ở từng chỗ.
    function watchIcons() {
        if (window.lucide) {
            const real = window.lucide.createIcons.bind(window.lucide);
            window.lucide.createIcons = (opts) => {
                if (opts) return real(opts);
                QLKH.icons();
            };
            const orig = real;
            QLKH.icons = function () {
                if (QLKH._iconQueued) return;
                QLKH._iconQueued = true;
                requestAnimationFrame(() => { QLKH._iconQueued = false; orig({ attrs: { 'stroke-width': 2 } }); });
            };
        }
        new MutationObserver(muts => {
            for (const m of muts) {
                for (const n of m.addedNodes) {
                    if (n.nodeType === 1 && (n.tagName === 'I' ? n.hasAttribute('data-lucide') : n.querySelector && n.querySelector('i[data-lucide]'))) {
                        QLKH.icons();
                        return;
                    }
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
        QLKH.icons();
    }
    document.addEventListener('DOMContentLoaded', watchIcons);
})();
