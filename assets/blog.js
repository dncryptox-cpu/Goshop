/* godnc.com — DNC. Nội dung: /content (site.json, posts.json, *.md) */
const CATS = { trading: 'Trading', chay: 'Chạy', tinh: 'Tĩnh', tien: 'Tiền', xuong: 'Xưởng' };
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = d => { const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}`; };
const getJSON = p => fetch(p, { cache: 'no-cache' }).then(r => r.json());
const visible = posts => posts.filter(p => !p.draft && !p.page).sort((a, b) => b.date.localeCompare(a.date) || (a.order || 0) - (b.order || 0));

function chrome(site, active) {
  const st = `<div class="status"><div class="wrap"><b>Chiến lược</b>${site.strategies.map(d =>
    `<span><i class="dot${d.state === 'watch' ? ' w' : ''}"></i>${esc(d.short)} <em>${esc(d.status)}</em></span>`).join('')}</div></div>`;
  const items = [['/', 'Trang chủ', 'home', 'hide-s'], ['/bai/', 'Bài viết', 'bai'], ['/ve-toi/', 'Về mình', 've-toi']];
  const nav = `<nav class="nav"><div class="wrap">
    <a class="brand" href="/">DNC<i>Hyperliquid · HIP-3</i></a>
    <ul>${items.map(([h, t, k, c]) => `<li class="${c || ''}"><a href="${h}" class="${k === active ? 'on' : ''}">${t}</a></li>`).join('')}
    <li><a class="btn" href="#dang-ky">Đăng ký</a></li></ul></div></nav>`;
  document.body.insertAdjacentHTML('afterbegin', st + nav);
}

function subscribe(site) {
  return `<div class="wrap"><div class="sub" id="dang-ky">
    <div><span class="kicker" style="color:#f0a070">Nhận ghi chép mới</span><h2 style="margin-top:14px">Có bài mới thì nhận qua email. <em>Chỉ vậy.</em></h2>
    <p>Chiến lược, số liệu, tool — và chỗ đã sai.</p></div>
    <div><form id="subForm"><input type="email" name="email" required placeholder="email@cuaban.com" autocomplete="email"><button class="btn" type="submit">Đăng ký →</button></form>
    <div class="msg" id="subMsg"></div><small>Không spam. Huỷ lúc nào cũng được.</small></div></div></div>`;
}

function bindSubscribe(site) {
  const f = $('#subForm'); if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const email = f.email.value.trim().toLowerCase(), msg = $('#subMsg'), btn = f.querySelector('button');
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Đang gửi…';
    try {
      const r = await fetch(site.subscribe.url + '/rest/v1/' + site.subscribe.table, {
        method: 'POST',
        headers: { apikey: site.subscribe.key, Authorization: 'Bearer ' + site.subscribe.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ email, source: location.pathname })
      });
      if (r.ok || r.status === 409) { msg.className = 'msg ok'; msg.textContent = 'Đã nhận. Thư đầu tiên sẽ tới sớm.'; f.reset(); }
      else throw new Error(r.status);
    } catch (err) { msg.className = 'msg err'; msg.textContent = 'Chưa gửi được. Thử lại sau, hoặc nhắn mình qua X.'; }
    btn.disabled = false;
  });
}

function footer(site) {
  return `<footer><div class="wrap"><div class="cols">
    <div><div class="big">DNC</div><div>${esc(site.tagline)}</div></div>
    <div><h4>Trang</h4><ul><li><a href="/bai/">Bài viết</a></li><li><a href="/ve-toi/">Về mình</a></li><li><a href="#dang-ky">Đăng ký thư</a></li></ul></div>
    <div><h4>Kênh</h4><ul>${site.social.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('')}</ul></div>
    <div><h4>Khác</h4><ul>${site.links.map(s => `<li><a href="${s.url}">${esc(s.name)}</a></li>`).join('')}</ul></div>
  </div><div class="legal"><span>© 2026 DNC · Nha Trang</span><span>Nội dung là ghi chép cá nhân, không phải lời khuyên đầu tư.</span></div></div></footer>`;
}

function postRow(p) {
  return `<li><a href="/bai/?s=${p.slug}"><time>${fmtDate(p.date)}</time>
    <div><h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}</div>
    <span class="tag ${p.cat}">${CATS[p.cat] || ''}</span></a></li>`;
}

/* ---------- trang chủ ---------- */
async function home() {
  const [site, posts] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/posts.json')]);
  const list = visible(posts);
  chrome(site, 'home');
  $('#rules').innerHTML = site.rules.map(r => `<span>${esc(r)}</span>`).join('');
  $('#strats').innerHTML = site.strategies.map((d, i) => {
    const inner = `<div class="top"><span class="n">0${i + 1} · ${esc(d.venue)}</span><span class="badge${d.state === 'watch' ? ' w' : ''}">${esc(d.status)}</span></div>
      <h3>${esc(d.title)}</h3><p>${esc(d.desc)}</p>
      <dl>${d.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${d.link ? `<div class="meta"><span class="go">${esc(d.cta)} →</span></div>` : ''}`;
    return d.link ? `<a class="do" href="${d.link}">${inner}</a>` : `<div class="do">${inner}</div>`;
  }).join('');
  $('#strat-count').textContent = String(site.strategies.length).padStart(2, '0') + ' mục';
  $('#latest').innerHTML = list.slice(0, 7).map(postRow).join('');
  $('#post-count').innerHTML = `<a href="/bai/">${list.length} bài · xem tất cả →</a>`;
  $('#apps').innerHTML = site.apps.map(a => `<a href="${a.url}"><b>${esc(a.name)}</b><span>${esc(a.what)}</span></a>`).join('');
  document.body.insertAdjacentHTML('beforeend', subscribe(site) + footer(site));
  bindSubscribe(site);
  liveFunding(site.live.dexes);
}

/* ---------- funding HIP-3 lúc này (Hyperliquid public API, chỉ đọc) ---------- */
async function hlDex(dex) {
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs', dex }) });
  if (!r.ok) throw new Error(r.status);
  const [meta, ctxs] = await r.json(), out = {};
  (meta?.universe || []).forEach((u, k) => {
    const c = ctxs[k]; if (!c || u.isDelisted) return;
    const sym = u.name.includes(':') ? u.name.split(':')[1] : u.name;
    out[sym] = { apr: (parseFloat(c.funding) || 0) * 24 * 365 * 100, px: parseFloat(c.markPx) || 0, vol: parseFloat(c.dayNtlVlm) || 0 };
  });
  return out;
}
const pct = (v, d = 2) => (v > 0 ? '+' : '') + v.toFixed(d) + '%';
const usd = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K' : '$' + v.toFixed(0);
async function liveFunding(dexes) {
  const box = $('#live'), upd = $('#live-upd'), [A, B] = dexes;
  try {
    const [a, b] = await Promise.all([hlDex(A), hlDex(B)]);
    const both = Object.keys(a).filter(k => b[k] && a[k].vol > 0 && b[k].vol > 0);
    let html;
    if (both.length) {
      const rows = both.map(k => {
        const hi = a[k].apr >= b[k].apr ? [A, a[k]] : [B, b[k]], lo = hi[0] === A ? [B, b[k]] : [A, a[k]];
        return { k, aA: a[k].apr, aB: b[k].apr, sp: hi[1].apr - lo[1].apr, basis: lo[1].px ? (hi[1].px - lo[1].px) / lo[1].px * 100 : 0, s: hi[0], l: lo[0], v: Math.min(a[k].vol, b[k].vol) };
      }).sort((x, y) => y.sp - x.sp).slice(0, 8);
      html = `<table><thead><tr><th>Mã</th><th>${A} APR</th><th>${B} APR</th><th>Chênh APR</th><th>Basis</th><th class="hide-s">Short / Long</th><th class="hide-s">Vol 24h (min)</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><b>${esc(r.k)}</b></td><td class="${r.aA < 0 ? 'neg' : ''}">${pct(r.aA, 1)}</td><td class="${r.aB < 0 ? 'neg' : ''}">${pct(r.aB, 1)}</td>
        <td class="hl">${r.sp.toFixed(1)}%</td><td class="${Math.abs(r.basis) > 0.5 ? 'warn' : ''}">${pct(r.basis, 2)}</td><td class="hide-s">${r.s} / ${r.l}</td><td class="hide-s">${usd(r.v)}</td></tr>`).join('')}</tbody></table>`;
    } else {
      const rows = [...Object.entries(a).map(([k, v]) => [k, A, v]), ...Object.entries(b).map(([k, v]) => [k, B, v])]
        .filter(r => r[2].vol > 0).sort((x, y) => Math.abs(y[2].apr) - Math.abs(x[2].apr)).slice(0, 8);
      html = `<table><thead><tr><th>Mã</th><th>Sàn</th><th>Funding APR</th><th>Vol 24h</th></tr></thead><tbody>
        ${rows.map(([k, d, v]) => `<tr><td><b>${esc(k)}</b></td><td>${d}</td><td class="hl">${pct(v.apr, 1)}</td><td>${usd(v.vol)}</td></tr>`).join('')}</tbody></table>`;
    }
    box.innerHTML = html;
    upd.textContent = 'Cập nhật ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · tự làm mới 60s';
  } catch (e) {
    box.innerHTML = '<p class="empty">Không tải được dữ liệu Hyperliquid lúc này. Thử tải lại trang.</p>';
  }
  clearTimeout(window.__lf); window.__lf = setTimeout(() => liveFunding(dexes), 60000);
}

/* ---------- danh sách + đọc bài ---------- */
async function reader(fixedSlug) {
  const q = new URLSearchParams(location.search);
  const slug = fixedSlug || q.get('s');
  const [site, posts] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/posts.json')]);
  const main = $('#main');

  if (!slug) {
    const c = q.get('c');
    chrome(site, 'bai');
    const all = visible(posts), list = c ? all.filter(p => p.cat === c) : all;
    document.title = (c ? CATS[c] : 'Bài viết') + ' — DNC';
    main.innerHTML = `<div class="wrap"><header class="page-head"><span class="kicker">${c ? 'Chủ đề' : 'Tất cả · ' + all.length + ' bài'}</span>
      <h1>${c ? CATS[c] : 'Bài viết'}</h1>
      <div class="chips"><a href="/bai/" class="${!c ? 'on' : ''}">Tất cả</a>${Object.keys(CATS).map(k => `<a href="/bai/?c=${k}" class="${c === k ? 'on' : ''}">${CATS[k]}</a>`).join('')}</div></header>
      <ul class="posts">${list.map(postRow).join('') || '<p class="empty">Chưa có bài trong mục này.</p>'}</ul></div>`;
  } else {
    const p = posts.find(x => x.slug === slug);
    chrome(site, p && p.page ? slug : 'bai');
    if (!p) { main.innerHTML = `<div class="art"><header><h1>Không tìm thấy bài</h1><p><a href="/bai/" style="color:var(--sun)">← Về danh sách</a></p></header></div>`; }
    else {
      document.title = p.title + ' — DNC';
      const md = await fetch(`/content/${slug}.md`, { cache: 'no-cache' }).then(r => r.text());
      const meta = p.page ? (p.date ? 'Cập nhật ' + fmtDate(p.date) : '') : `${fmtDate(p.date)} · ${CATS[p.cat] || ''}`;
      main.innerHTML = `${p.cover ? `<div class="art-cover"><img src="${p.cover}" alt=""></div>` : ''}
        <article class="art"><header><span class="kicker">${p.page ? 'DNC' : CATS[p.cat] || ''}</span>
        <h1>${esc(p.title)}</h1><div class="by">${meta}</div></header>
        <div class="prose">${marked.parse(md)}</div>
        ${p.cat === 'trading' ? '<div class="note">Ghi chép cá nhân, không phải lời khuyên đầu tư. Tự nghiên cứu và tự chịu trách nhiệm với vốn của mình.</div>' : ''}</article>
        ${p.page ? '' : `<div class="art-foot"><a href="/bai/">← Tất cả bài</a><a href="/bai/?c=${p.cat}">Thêm về ${CATS[p.cat]} →</a></div>`}`;
      main.querySelectorAll('.prose a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    }
  }
  document.body.insertAdjacentHTML('beforeend', subscribe(site) + footer(site));
  bindSubscribe(site);
}
