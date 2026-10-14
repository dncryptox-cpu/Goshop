/* godnc.com blog — tất cả nội dung nằm trong /content (site.json, posts.json, *.md) */
const CATS = { chay: 'Chạy', tinh: 'Tĩnh', tien: 'Tiền', xuong: 'Xưởng' };
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = d => { const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}`; };
const getJSON = p => fetch(p, { cache: 'no-cache' }).then(r => r.json());

function nav(active, over) {
  const items = [['/bai/', 'Bài viết', 'bai'], ['/bai/?c=chay', 'Chạy', 'chay', 'hide-s'], ['/now/', 'Bây giờ', 'now'], ['/ve-toi/', 'Về tôi', 've-toi']];
  return `<nav class="nav${over ? ' over' : ''}"><div class="wrap">
    <a class="brand" href="/">dnc<span>.</span></a>
    <ul>${items.map(([h, t, k, c]) => `<li class="${c || ''}"><a href="${h}" class="${k === active ? 'on' : ''}">${t}</a></li>`).join('')}</ul>
  </div></nav>`;
}

function footer(site) {
  return `<footer><div class="wrap">
    <div><div class="big">a place to keep.</div><div>${esc(site.tagline)}</div></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <ul>${site.social.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('')}</ul>
      <ul>${site.links.map(s => `<li><a href="${s.url}">${esc(s.name)}</a></li>`).join('')}</ul>
    </div>
  </div></footer>`;
}

function postRow(p) {
  return `<li><a href="/bai/?s=${p.slug}">
    <time>${fmtDate(p.date)}</time>
    <div><h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}</div>
    <span class="tag">${CATS[p.cat] || ''}</span></a></li>`;
}

const visible = posts => posts.filter(p => !p.draft && !p.page).sort((a, b) => b.date.localeCompare(a.date));

/* ---------- trang chủ ---------- */
async function home() {
  const [site, posts] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/posts.json')]);
  const list = visible(posts);
  document.body.insertAdjacentHTML('afterbegin', nav('', true));
  $('#facts').innerHTML = site.facts.map(f => `<div><b>${esc(f.v)}</b><span>${esc(f.k)}</span></div>`).join('');
  $('#now-list').innerHTML = site.now.items.map(i => `<li><span>${esc(i.k)}</span><div>${esc(i.v)}</div></li>`).join('');
  $('#now-upd').textContent = 'Cập nhật ' + fmtDate(site.now.updated);
  $('#latest').innerHTML = list.slice(0, 5).map(postRow).join('') || '<p class="empty">Chưa có bài.</p>';
  $('#races').innerHTML = site.races.map(r => {
    const inner = `<span class="yr">${esc(r.year)}</span><h3>${esc(r.name)}</h3><span class="meta">${esc(r.meta || '')}</span><span class="st">${esc(r.status)}${r.post ? ' →' : ''}</span>`;
    return r.post ? `<a class="race link" href="/bai/?s=${r.post}">${inner}</a>` : `<div class="race">${inner}</div>`;
  }).join('');
  $('#pillars').innerHTML = Object.entries(site.pillars).map(([k, d]) => {
    const n = list.filter(p => p.cat === k).length;
    return `<a href="/bai/?c=${k}"><b>${CATS[k]}</b><p>${esc(d)}</p><span class="n">${n ? n + ' bài' : 'Sắp có'}</span></a>`;
  }).join('');
  $('#apps').innerHTML = site.apps.map(a => `<a href="${a.url}"><b>${esc(a.name)}</b><span>${esc(a.what)}</span></a>`).join('');
  document.body.insertAdjacentHTML('beforeend', footer(site));
}

/* ---------- danh sách + đọc bài ---------- */
async function reader(fixedSlug) {
  const q = new URLSearchParams(location.search);
  const slug = fixedSlug || q.get('s');
  const [site, posts] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/posts.json')]);
  const main = $('#main');

  if (!slug) {
    const c = q.get('c');
    document.body.insertAdjacentHTML('afterbegin', nav(c === 'chay' ? 'chay' : 'bai'));
    const all = visible(posts), list = c ? all.filter(p => p.cat === c) : all;
    document.title = (c ? CATS[c] + ' — ' : 'Bài viết — ') + 'dnc';
    main.innerHTML = `<div class="wrap"><header class="page-head"><span class="kicker">${c ? 'Chủ đề' : 'Tất cả'}</span>
      <h1>${c ? CATS[c] : 'Bài viết'}</h1>${c ? `<p style="color:var(--mute);max-width:56ch;margin-top:12px">${esc(site.pillars[c] || '')}</p>` : ''}
      <div class="chips"><a href="/bai/" class="${!c ? 'on' : ''}">Tất cả</a>${Object.keys(CATS).map(k => `<a href="/bai/?c=${k}" class="${c === k ? 'on' : ''}">${CATS[k]}</a>`).join('')}</div></header>
      <ul class="posts">${list.map(postRow).join('') || '<p class="empty">Chưa có bài trong mục này.</p>'}</ul></div>`;
    document.body.insertAdjacentHTML('beforeend', footer(site));
    return;
  }

  const p = posts.find(x => x.slug === slug);
  document.body.insertAdjacentHTML('afterbegin', nav(p && p.page ? slug : (p && p.cat === 'chay' ? 'chay' : 'bai')));
  if (!p) { main.innerHTML = `<div class="art"><header><h1>Không tìm thấy bài</h1><p><a href="/bai/" style="color:var(--sun2)">← Về danh sách</a></p></header></div>`; return; }
  document.title = p.title + ' — dnc';
  const md = await fetch(`/content/${slug}.md`, { cache: 'no-cache' }).then(r => r.text());
  const meta = p.page ? (p.date ? 'Cập nhật ' + fmtDate(p.date) : '') : `${fmtDate(p.date)} · ${CATS[p.cat] || ''}`;
  main.innerHTML = `${p.cover ? `<div class="art-cover"><img src="${p.cover}" alt=""></div>` : ''}
    <article class="art${p.cover ? ' has-cover' : ''}"><header><span class="kicker">${p.page ? 'dnc' : CATS[p.cat] || ''}</span>
    <h1>${esc(p.title)}</h1><div class="by">${meta}</div></header>
    <div class="prose">${marked.parse(md)}</div></article>
    ${p.page ? '' : `<div class="art-foot"><a href="/bai/">← Tất cả bài</a><a href="/bai/?c=${p.cat}">Thêm về ${CATS[p.cat]} →</a></div>`}`;
  main.querySelectorAll('.prose a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  document.body.insertAdjacentHTML('beforeend', footer(site));
}
