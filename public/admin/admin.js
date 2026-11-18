(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

  let data = null;
  let view = 'dashboard';
  let me = null;

  /* ---------------- api ---------------- */
  async function api(method, url, body) {
    const opts = { method, headers: {} };
    if (body instanceof FormData) opts.body = body;
    else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Session expired, please log in again'); }
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  }
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show' + (isErr ? ' error' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 2600);
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  /* ---------------- auth ---------------- */
  function showLogin() { $('#appView').hidden = true; $('#loginView').hidden = false; $('#loginForm').password.focus(); }
  async function boot() {
    try { me = await api('GET', '/api/admin/me'); } catch { return showLogin(); }
    $('#loginView').hidden = true; $('#appView').hidden = false;
    $('#pwWarn').hidden = !me.mustChange;
    try { await reload(); go(location.hash.slice(1) || 'dashboard'); } catch (e) { toast(e.message, true); console.error(e); }
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    $('#loginErr').textContent = '';
    try {
      await api('POST', '/api/admin/login', { username: f.username.value, password: f.password.value });
      f.password.value = '';
      boot();
    } catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logoutBtn').addEventListener('click', async () => { await api('POST', '/api/admin/logout'); showLogin(); });

  async function reload() {
    data = await api('GET', '/api/admin/data');
    const newRes = data.reservations.filter((r) => r.status === 'new').length;
    const pendRev = data.reviews.filter((r) => !r.approved).length;
    $('#badgeRes').textContent = newRes || '';
    $('#badgeRev').textContent = pendRev || '';
  }

  /* ---------------- navigation ---------------- */
  const titles = { dashboard: 'Dashboard', reservations: 'Bookings & Enquiries', menu: 'Menu Items', categories: 'Categories', slides: 'Hero Slides', gallery: 'Gallery', reviews: 'Reviews', settings: 'Site Settings', account: 'Account' };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-view]');
    if (a) { e.preventDefault(); go(a.dataset.view); $('#sidebar').classList.remove('open'); }
  });
  addEventListener('hashchange', () => { const v = location.hash.slice(1); if (data && v !== view) go(v); });
  $('#sideToggle').addEventListener('click', (e) => { e.stopPropagation(); $('#sidebar').classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#sidebar')) $('#sidebar').classList.remove('open'); });

  function go(v) {
    if (!titles[v]) v = 'dashboard';
    view = v;
    history.replaceState(null, '', '#' + v);
    $$('#sideNav a').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
    $('#viewTitle').textContent = titles[v];
    $('#topActions').innerHTML = '';
    views[v]();
  }
  const rerender = async () => { await reload(); views[view](); };
  const topButton = (label, fn) => { const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = label; b.onclick = fn; $('#topActions').append(b); };
  const catName = (id) => data.categories.find((c) => c.id === id)?.name || '—';
  const sorted = (arr) => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  /* ---------------- generic edit modal ---------------- */
  // field: { key, label, type: text|textarea|number|checkbox|select|image|date|time, options, full }
  function editModal({ title, fields, item = {}, onSave }) {
    const box = $('#editFields');
    $('#editTitle').textContent = title;
    box.innerHTML = fields.map((f) => {
      const v = item[f.key] ?? f.default ?? '';
      const cls = f.full || ['textarea', 'image'].includes(f.type) ? 'full' : '';
      if (f.type === 'checkbox') return `<label class="check ${cls}"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}/> ${esc(f.label)}</label>`;
      if (f.type === 'textarea') return `<label class="${cls}">${esc(f.label)}<textarea name="${f.key}" rows="${f.rows || 3}">${esc(v)}</textarea></label>`;
      if (f.type === 'select') return `<label class="${cls}">${esc(f.label)}<select name="${f.key}">${f.options().map((o) => `<option value="${esc(o.value)}" ${o.value === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
      if (f.type === 'image') return imageField(f, v);
      return `<label class="${cls}">${esc(f.label)}<input name="${f.key}" type="${f.type || 'text'}" value="${esc(v)}" ${f.required ? 'required' : ''} ${f.type === 'number' ? 'step="any" min="0"' : ''}/></label>`;
    }).join('');
    wireImageFields(box);
    const dlg = $('#editModal');
    const form = $('#editForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        const el = form.elements[f.key];
        out[f.key] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? Number(el.value) : el.value.trim();
      }
      const btn = $('#editSave');
      btn.disabled = true;
      try { await onSave(out); dlg.close(); toast('Saved'); await rerender(); }
      catch (err) { toast(err.message, true); }
      finally { btn.disabled = false; }
    };
    dlg.showModal();
    box.querySelector('input,textarea,select')?.focus();
  }
  $$('#editModal [data-close]').forEach((b) => b.addEventListener('click', () => $('#editModal').close()));

  function imageField(f, v) {
    return `<div class="full"><label>${esc(f.label)}</label>
      <div class="img-field"><img src="${esc(v)}" alt="" onerror="this.style.visibility='hidden'" onload="this.style.visibility='visible'"/>
        <div class="img-ctrl">
          <input name="${f.key}" value="${esc(v)}" placeholder="Paste an image URL or upload" />
          <span class="btn btn-ghost btn-sm upload">⬆ Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-for="${f.key}"/></span>
        </div></div></div>`;
  }
  function wireImageFields(root) {
    $$('.img-field', root).forEach((w) => {
      const urlIn = $('input[name]', w), prev = $('img', w), file = $('input[type=file]', w);
      urlIn.addEventListener('input', () => (prev.src = urlIn.value));
      file.addEventListener('change', guard(async () => {
        if (!file.files[0]) return;
        const fd = new FormData(); fd.append('image', file.files[0]);
        const label = file.parentElement.firstChild; label.textContent = 'Uploading… ';
        try { const { url } = await api('POST', '/api/admin/upload', fd); urlIn.value = url; prev.src = url; toast('Image uploaded'); }
        finally { label.textContent = '⬆ Upload image'; file.value = ''; }
      }));
    });
  }

  const crud = (resource) => ({
    create: (body) => api('POST', `/api/admin/${resource}`, body),
    update: (id, body) => api('PUT', `/api/admin/${resource}/${id}`, body),
    remove: guard(async (id, what = 'this item') => {
      if (!confirm(`Delete ${what}? This cannot be undone.`)) return;
      await api('DELETE', `/api/admin/${resource}/${id}`); toast('Deleted'); await rerender();
    }),
  });

  function table(cols, rows, empty = 'Nothing here yet.') {
    return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td class="empty-row" colspan="${cols.length}">${empty}</td></tr>`}</tbody></table></div>`;
  }

  /* ---------------- views ---------------- */
  const views = {};

  views.dashboard = () => {
    const res = data.reservations;
    const today = new Date().toISOString().slice(0, 10);
    const avg = data.reviews.filter((r) => r.approved).reduce((s, r, _, a) => s + r.rating / a.length, 0);
    $('#content').innerHTML = `
      <div class="stats">
        <div class="stat" data-view="reservations"><b>${res.filter((r) => r.status === 'new').length}</b><span>New bookings / enquiries</span></div>
        <div class="stat" data-view="reservations"><b>${res.filter((r) => r.date === today && r.status !== 'cancelled').length}</b><span>Tables booked for today</span></div>
        <div class="stat" data-view="menu"><b>${data.menu.filter((m) => m.available).length}<small class="muted">/${data.menu.length}</small></b><span>Dishes available</span></div>
        <div class="stat" data-view="reviews"><b>${avg ? avg.toFixed(1) + '★' : '—'}</b><span>Avg rating · ${data.reviews.filter((r) => !r.approved).length} pending</span></div>
        <div class="stat" data-view="gallery"><b>${data.gallery.length}</b><span>Gallery photos</span></div>
      </div>
      <div class="panel"><h3>Latest bookings &amp; enquiries</h3>
        ${resTable([...res].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6))}
      </div>`;
    wireRes();
  };

  /* ---- reservations ---- */
  const statusPill = { new: 'gold', confirmed: 'green', done: 'blue', cancelled: 'red' };
  function resTable(list) {
    return table(['Received', 'Type', 'Guest', 'For', 'Message', 'Status', ''], list.map((r) => `
      <tr><td>${fmtDate(r.createdAt)}</td>
        <td><span class="pill">${esc(r.type)}</span></td>
        <td><strong>${esc(r.name)}</strong><br><a href="tel:${esc(r.phone)}" class="muted">${esc(r.phone)}</a></td>
        <td style="white-space:nowrap">${r.type === 'table' ? `${esc(r.date) || '—'} ${esc(r.time)}<br><span class="muted">${r.guests || '?'} guests</span>` : '—'}</td>
        <td class="msg">${esc(r.message) || '—'}</td>
        <td><select data-status="${r.id}" class="pill ${statusPill[r.status] || ''}" style="width:auto;border:0">${['new', 'confirmed', 'done', 'cancelled'].map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td class="actions"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${esc(r.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1'))}">WhatsApp</a><button class="btn btn-danger btn-sm" data-del-res="${r.id}">Delete</button></td></tr>`), 'No bookings yet.');
  }
  function wireRes() {
    $$('[data-status]').forEach((s) => s.addEventListener('change', guard(async () => { await api('PUT', `/api/admin/reservations/${s.dataset.status}`, { status: s.value }); toast('Status updated'); await rerender(); })));
    $$('[data-del-res]').forEach((b) => b.addEventListener('click', () => crud('reservations').remove(b.dataset.delRes, 'this booking')));
  }
  let resFilter = 'active';
  views.reservations = () => {
    let list = [...data.reservations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (resFilter === 'active') list = list.filter((r) => ['new', 'confirmed'].includes(r.status));
    else if (resFilter !== 'all') list = list.filter((r) => r.status === resFilter);
    $('#content').innerHTML = `
      <div class="toolbar"><select id="resFilter">${[['active', 'Active (new + confirmed)'], ['all', 'All'], ['new', 'New'], ['confirmed', 'Confirmed'], ['done', 'Done'], ['cancelled', 'Cancelled']].map(([v, l]) => `<option value="${v}" ${v === resFilter ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="muted">${list.length} shown</span></div>${resTable(list)}`;
    $('#resFilter').onchange = (e) => { resFilter = e.target.value; views.reservations(); };
    wireRes();
  };

  /* ---- menu ---- */
  const menuFields = () => [
    { key: 'name', label: 'Dish name', required: true },
    { key: 'category', label: 'Category', type: 'select', options: () => [{ value: '', label: '— none —' }, ...sorted(data.categories).map((c) => ({ value: c.id, label: c.name }))] },
    { key: 'price', label: 'Price (₹)', type: 'number' },
    { key: 'order', label: 'Sort order', type: 'number' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'image', label: 'Photo', type: 'image' },
    { key: 'veg', label: 'Vegetarian', type: 'checkbox' },
    { key: 'signature', label: 'Signature dish (shown on homepage)', type: 'checkbox' },
    { key: 'available', label: 'Available (shown on menu)', type: 'checkbox', default: true },
  ];
  let menuQ = '', menuCat = '';
  views.menu = () => {
    const c = crud('menu');
    topButton('+ Add dish', () => editModal({ title: 'Add dish', fields: menuFields(), item: { category: menuCat }, onSave: c.create }));
    const list = sorted(data.menu).filter((m) => (!menuCat || m.category === menuCat) && (!menuQ || m.name.toLowerCase().includes(menuQ.toLowerCase())));
    $('#content').innerHTML = `
      <div class="toolbar"><input type="search" id="menuQ" placeholder="Search dishes…" value="${esc(menuQ)}"/>
        <select id="menuCat"><option value="">All categories</option>${sorted(data.categories).map((x) => `<option value="${esc(x.id)}" ${x.id === menuCat ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <span class="muted">${list.length} dishes</span></div>
      ${table(['', 'Dish', 'Category', 'Price', 'Signature', 'Available', ''], list.map((m) => `
        <tr><td><img class="thumb" src="${esc(m.image)}" alt="" loading="lazy"/></td>
          <td class="main"><span class="veg ${m.veg ? 'v' : 'n'}"></span><strong>${esc(m.name)}</strong><br><span class="muted small">${esc((m.description || '').slice(0, 70))}${(m.description || '').length > 70 ? '…' : ''}</span></td>
          <td>${esc(catName(m.category))}</td><td>₹${m.price}</td>
          <td>${m.signature ? '<span class="pill gold">★ Signature</span>' : ''}</td>
          <td><label class="switch"><input type="checkbox" data-avail="${m.id}" ${m.available ? 'checked' : ''}/><span></span></label></td>
          <td class="actions"><button class="btn btn-ghost btn-sm" data-edit="${m.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${m.id}">Delete</button></td></tr>`), 'No dishes found.')}`;
    const q = $('#menuQ');
    q.oninput = () => { menuQ = q.value; const pos = q.selectionStart; views.menu(); const n = $('#menuQ'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#menuCat').onchange = (e) => { menuCat = e.target.value; views.menu(); };
    $$('[data-avail]').forEach((el) => el.addEventListener('change', guard(async () => { await c.update(el.dataset.avail, { available: el.checked }); toast(el.checked ? 'Dish is now visible' : 'Dish hidden from menu'); await reload(); })));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => { const m = data.menu.find((x) => x.id === b.dataset.edit); editModal({ title: 'Edit dish', fields: menuFields(), item: m, onSave: (body) => c.update(m.id, body) }); }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => c.remove(b.dataset.del, `"${data.menu.find((x) => x.id === b.dataset.del).name}"`)));
  };

  /* ---- categories ---- */
  views.categories = () => {
    const c = crud('categories');
    const fields = [{ key: 'name', label: 'Category name', required: true, full: true }, { key: 'order', label: 'Sort order', type: 'number' }];
    topButton('+ Add category', () => editModal({ title: 'Add category', fields, onSave: c.create }));
    $('#content').innerHTML = table(['Order', 'Name', 'Dishes', ''], sorted(data.categories).map((x) => `
      <tr><td>${x.order}</td><td><strong>${esc(x.name)}</strong></td><td>${data.menu.filter((m) => m.category === x.id).length}</td>
        <td class="actions"><button class="btn btn-ghost btn-sm" data-edit="${x.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${x.id}">Delete</button></td></tr>`));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => { const x = data.categories.find((y) => y.id === b.dataset.edit); editModal({ title: 'Edit category', fields, item: x, onSave: (body) => c.update(x.id, body) }); }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => c.remove(b.dataset.del, 'this category (its dishes will become uncategorised)')));
  };

  /* ---- slides ---- */
  views.slides = () => {
    const c = crud('slides');
    const fields = [
      { key: 'script', label: 'Script line (e.g. "A Taste of Malabar,")' },
      { key: 'title', label: 'Headline', required: true },
      { key: 'text', label: 'Sub-text', type: 'textarea', rows: 2 },
      { key: 'label', label: 'Dish label (bottom-right)' },
      { key: 'order', label: 'Sort order', type: 'number' },
      { key: 'image', label: 'Background image (wide, 1600px+)', type: 'image' },
    ];
    topButton('+ Add slide', () => editModal({ title: 'Add slide', fields, onSave: c.create }));
    $('#content').innerHTML = table(['', 'Slide', 'Label', 'Order', ''], sorted(data.slides).map((s) => `
      <tr><td><img class="thumb thumb-wide" src="${esc(s.image)}" alt=""/></td><td><em>${esc(s.script)}</em><br><strong>${esc(s.title)}</strong></td><td>${esc(s.label)}</td><td>${s.order}</td>
        <td class="actions"><button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${s.id}">Delete</button></td></tr>`));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => { const s = data.slides.find((y) => y.id === b.dataset.edit); editModal({ title: 'Edit slide', fields, item: s, onSave: (body) => c.update(s.id, body) }); }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => c.remove(b.dataset.del, 'this slide')));
  };

  /* ---- gallery ---- */
  views.gallery = () => {
    const c = crud('gallery');
    const fields = [{ key: 'title', label: 'Caption' }, { key: 'order', label: 'Sort order', type: 'number' }, { key: 'image', label: 'Photo', type: 'image' }];
    topButton('+ Add photo', () => editModal({ title: 'Add photo', fields, onSave: c.create }));
    $('#content').innerHTML = `<div class="grid-cards">${sorted(data.gallery).map((g) => `
      <div class="gcard"><img src="${esc(g.image)}" alt="" loading="lazy"/><div class="gc-body"><span title="${esc(g.title)}">${esc(g.title) || '<em class="muted">No caption</em>'}</span>
        <button class="btn btn-ghost btn-sm" data-edit="${g.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${g.id}">✕</button></div></div>`).join('') || '<p class="muted">No photos yet.</p>'}</div>`;
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => { const g = data.gallery.find((y) => y.id === b.dataset.edit); editModal({ title: 'Edit photo', fields, item: g, onSave: (body) => c.update(g.id, body) }); }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => c.remove(b.dataset.del, 'this photo')));
  };

  /* ---- reviews ---- */
  let revFilter = 'all';
  views.reviews = () => {
    const c = crud('reviews');
    const fields = [{ key: 'name', label: 'Name', required: true }, { key: 'rating', label: 'Rating (1–5)', type: 'number' }, { key: 'text', label: 'Review', type: 'textarea', rows: 4 }, { key: 'approved', label: 'Approved (visible on website)', type: 'checkbox', default: true }];
    topButton('+ Add review', () => editModal({ title: 'Add review', fields, onSave: c.create }));
    let list = [...data.reviews].sort((a, b) => (a.approved - b.approved) || b.createdAt.localeCompare(a.createdAt));
    if (revFilter !== 'all') list = list.filter((r) => (revFilter === 'pending' ? !r.approved : r.approved));
    $('#content').innerHTML = `
      <div class="toolbar"><select id="revFilter">${[['all', 'All reviews'], ['pending', 'Pending approval'], ['approved', 'Approved']].map(([v, l]) => `<option value="${v}" ${v === revFilter ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${table(['Date', 'Guest', 'Rating', 'Review', 'Status', ''], list.map((r) => `
      <tr><td>${fmtDate(r.createdAt)}</td><td><strong>${esc(r.name)}</strong></td><td style="color:var(--gold)">${'★'.repeat(r.rating)}</td>
        <td class="review-text">${esc(r.text)}</td>
        <td>${r.approved ? '<span class="pill green">Published</span>' : '<span class="pill gold">Pending</span>'}</td>
        <td class="actions">${r.approved ? `<button class="btn btn-ghost btn-sm" data-appr="${r.id}" data-v="0">Hide</button>` : `<button class="btn btn-primary btn-sm" data-appr="${r.id}" data-v="1">Approve</button>`}
          <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button></td></tr>`), 'No reviews.')}`;
    $('#revFilter').onchange = (e) => { revFilter = e.target.value; views.reviews(); };
    $$('[data-appr]').forEach((b) => b.addEventListener('click', guard(async () => { await c.update(b.dataset.appr, { approved: b.dataset.v === '1' }); toast(b.dataset.v === '1' ? 'Review published' : 'Review hidden'); await rerender(); })));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => { const r = data.reviews.find((y) => y.id === b.dataset.edit); editModal({ title: 'Edit review', fields, item: r, onSave: (body) => c.update(r.id, body) }); }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => c.remove(b.dataset.del, 'this review')));
  };

  /* ---- settings ---- */
  views.settings = () => {
    const s = data.settings;
    const groups = [
      ['Restaurant', [['name', 'Restaurant name'], ['location', 'Location (shown under logo)'], ['tagline', 'Footer tagline'], ['announcement', 'Announcement bar (leave empty to hide)']]],
      ['Contact', [['address', 'Address', 'full'], ['mapQuery', 'Google Maps search text', 'full'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp number (with country code, e.g. 919876543210)'], ['email', 'Email'], ['hours', 'Opening hours']]],
      ['Social', [['instagram', 'Instagram URL'], ['facebook', 'Facebook URL'], ['youtube', 'YouTube URL']]],
      ['Our Story', [['storyTitle', 'Heading', 'full'], ['storyText', 'Short intro', 'textarea'], ['storyLong', '"Know more" text', 'textarea'], ['storyImage', 'Story image', 'image'], ['storefrontImage', '"Find Us" photo', 'image']]],
    ];
    $('#content').innerHTML = `<form id="settingsForm">${groups.map(([g, fields]) => `
      <div class="panel"><h3>${g}</h3><div class="form-grid">${fields.map(([k, l, t]) =>
        t === 'image' ? imageField({ key: k, label: l }, s[k]) :
        t === 'textarea' ? `<label class="full">${l}<textarea name="${k}" rows="3">${esc(s[k])}</textarea></label>` :
        `<label class="${t === 'full' ? 'full' : ''}">${l}<input name="${k}" value="${esc(s[k])}"/></label>`).join('')}</div></div>`).join('')}
      <div class="form-actions"><button class="btn btn-primary" type="submit">Save settings</button></div></form>`;
    wireImageFields($('#settingsForm'));
    $('#settingsForm').onsubmit = guard(async (e) => {
      e.preventDefault();
      await api('PUT', '/api/admin/settings', Object.fromEntries(new FormData(e.target)));
      toast('Settings saved'); await reload();
    });
  };

  /* ---- account ---- */
  views.account = () => {
    $('#content').innerHTML = `
      <form class="panel" id="pwForm" style="max-width:480px"><h3>Change login</h3>
        <div class="form-grid" style="grid-template-columns:1fr">
          <label>Username<input name="username" value="${esc(me?.username || 'admin')}" autocomplete="username" required/></label>
          <label>Current password<input name="current" type="password" autocomplete="current-password" required/></label>
          <label>New password (min 8 characters)<input name="next" type="password" minlength="8" autocomplete="new-password" required/></label>
          <label>Confirm new password<input name="confirm" type="password" minlength="8" autocomplete="new-password" required/></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Update</button></div></form>`;
    $('#pwForm').onsubmit = guard(async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (f.next !== f.confirm) throw new Error('New passwords do not match');
      await api('POST', '/api/admin/password', f);
      e.target.reset(); toast('Login updated'); $('#pwWarn').hidden = true;
      me = await api('GET', '/api/admin/me'); views.account();
    });
  };

  // Label table cells so phones can show tables as stacked cards
  const labelTables = () => $$('#content table').forEach((t) => {
    const hs = $$('th', t).map((th) => th.textContent.trim());
    $$('tbody tr', t).forEach((tr) => [...tr.children].forEach((td, i) => { if (!td.classList.contains('empty-row')) td.dataset.label = hs[i] || ''; }));
  });
  new MutationObserver(labelTables).observe($('#content'), { childList: true, subtree: true });

  boot();
})();
