(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FALLBACK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#1a2d21"/><text x="2" y="1.8" font-size=".9" text-anchor="middle" fill="#e8b45a">🍛</text></svg>');
  const img = (src, alt, attrs = '') => `<img src="${esc(src || FALLBACK)}" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'" ${attrs}/>`;

  let data;
  const cart = new Map(); // id -> qty
  $('#year').textContent = new Date().getFullYear();

  /* ---------- header ---------- */
  const header = $('.header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger'), nav = $('#nav');
  const setNav = (open) => {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  $('#navBackdrop').addEventListener('click', () => setNav(false));
  addEventListener('keydown', (e) => e.key === 'Escape' && setNav(false));
  $$('#nav a, #nav button').forEach((a) => a.addEventListener('click', () => setNav(false)));
  $$('[data-open-qr]').forEach((b) => b.addEventListener('click', () => $('#qrModal').showModal()));
  $$('[data-order]').forEach((b) => b.addEventListener('click', () => $('#orderBtn').click()));

  // active link on scroll
  const sections = ['story', 'menu', 'gallery', 'reviews', 'visit'].map((id) => document.getElementById(id));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));
  new IntersectionObserver(([e]) => { if (e.isIntersecting) $$('#nav a').forEach((a, i) => a.classList.toggle('active', i === 0)); }, { threshold: .5 }).observe($('.hero'));

  /* ---------- modals ---------- */
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });
  $('#qrBtn').addEventListener('click', () => $('#qrModal').showModal());

  /* ---------- load data ---------- */
  fetch('/api/public').then((r) => r.json()).then((d) => { data = d; render(); }).catch(() => {
    $('#menuGrid').innerHTML = '<p class="empty">Could not load the menu. Please refresh.</p>';
  });

  function render() {
    const s = data.settings;
    const [a, ...b] = s.name.split(' ');
    $$('[data-s="nameA"]').forEach((el) => (el.textContent = a));
    $$('[data-s="nameB"]').forEach((el) => (el.textContent = b.join(' ')));
    $$('[data-s]').forEach((el) => { if (el.dataset.s in s) el.textContent = el.dataset.s === 'location' && el.classList.contains('logo-loc') ? s.location.toUpperCase() : s[el.dataset.s]; });

    $('#storyTitle').textContent = s.storyTitle;
    $('#storyText').textContent = s.storyText;
    $('#storyLong').textContent = s.storyLong;
    $('#storyImg').src = s.storyImage || FALLBACK;
    $('#storefrontImg').src = s.storefrontImage || FALLBACK;
    $('#storyMore').hidden = !s.storyLong;
    $('#storyMore').onclick = () => { const p = $('#storyLong'); p.hidden = !p.hidden; $('#storyMore').firstChild.textContent = p.hidden ? 'Know More ' : 'Show Less '; };

    if (s.announcement) { const an = $('#announcement'); an.textContent = s.announcement; an.hidden = false; }

    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapQuery || s.address);
    $('#directionsBtn').href = mapsUrl;
    $('#mapFrame').src = 'https://maps.google.com/maps?q=' + encodeURIComponent(s.mapQuery || s.address) + '&z=15&output=embed';
    $('#phoneLink').href = 'tel:' + s.phone.replace(/\s/g, '');
    $('#emailLink').href = 'mailto:' + s.email;
    const wa = `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=` + encodeURIComponent(`Hi ${s.name}, I have an enquiry.`);
    $('#waBtn').href = wa; $('#waFloat').href = wa;
    $$('[data-wa]').forEach((a) => (a.href = wa));
    $$('[data-call]').forEach((a) => (a.href = 'tel:' + s.phone.replace(/\s/g, '')));
    $$('[data-directions]').forEach((a) => (a.href = mapsUrl));
    [['#igLink', s.instagram], ['#fbLink', s.facebook], ['#ytLink', s.youtube]].forEach(([sel, url]) => { const el = $(sel); if (url) el.href = url; else el.hidden = true; });

    renderHero();
    renderSignature();
    renderMenu();
    renderGallery();
    renderReviews();
    reveal();
  }

  /* ---------- hero slider ---------- */
  let slideIdx = 0, slideTimer;
  function renderHero() {
    const slides = data.slides;
    if (!slides.length) return;
    $('#heroSlides').innerHTML = slides.map((sl, i) => `<div class="hero-slide${i === 0 ? ' active' : ''}" style="background-image:url('${esc(sl.image)}')"></div>`).join('');
    $('#heroDots').innerHTML = slides.length > 1 ? slides.map((_, i) => `<button role="tab" aria-label="Slide ${i + 1}" class="${i === 0 ? 'active' : ''}"></button>`).join('') : '';
    $$('#heroDots button').forEach((b, i) => b.addEventListener('click', () => { goSlide(i); restart(); }));
    goSlide(0, true);
    restart();
  }
  function goSlide(i, first) {
    const slides = data.slides;
    slideIdx = (i + slides.length) % slides.length;
    const sl = slides[slideIdx];
    $$('.hero-slide').forEach((el, j) => el.classList.toggle('active', j === slideIdx));
    $$('#heroDots button').forEach((el, j) => el.classList.toggle('active', j === slideIdx));
    $('#heroScript').innerHTML = `<span class="spark">⟋</span>${esc(sl.script)}`;
    $('#heroTitle').textContent = sl.title;
    $('#heroText').textContent = sl.text;
    $('#heroLabel').innerHTML = esc(sl.label).replace(/ (?=\S+$)/, '<br>');
    $('#heroLabel').hidden = !sl.label;
    if (!first) { const c = $('.hero-content'); c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); }
  }
  function restart() {
    clearInterval(slideTimer);
    if (data.slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) slideTimer = setInterval(() => goSlide(slideIdx + 1), 6500);
  }

  /* ---------- signature ---------- */
  function renderSignature() {
    const sig = data.menu.filter((m) => m.signature).slice(0, 4);
    $('#sigGrid').innerHTML = sig.map((m) => `
      <article class="sig-card" data-id="${m.id}" tabindex="0">
        ${img(m.image, m.name)}
        <h3>${esc(m.name)}</h3><span class="price">₹${m.price}</span>
      </article>`).join('');
    $$('.sig-card').forEach((c) => {
      const go = () => { activeCat = data.menu.find((m) => m.id === c.dataset.id)?.category || 'all'; renderMenu(); document.getElementById('menu').scrollIntoView(); };
      c.addEventListener('click', go);
      c.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    });
  }

  /* ---------- menu ---------- */
  let activeCat = 'all';
  function renderMenu() {
    const cats = data.categories.filter((c) => data.menu.some((m) => m.category === c.id));
    $('#menuTabs').innerHTML = [{ id: 'all', name: 'All' }, ...cats].map((c) => `<button role="tab" data-cat="${esc(c.id)}" class="${c.id === activeCat ? 'active' : ''}">${esc(c.name)}</button>`).join('');
    $$('#menuTabs button').forEach((b) => b.addEventListener('click', () => { activeCat = b.dataset.cat; renderMenu(); }));
    const q = $('#menuSearch').value.trim().toLowerCase();
    const vegOnly = $('#vegOnly').checked;
    const items = data.menu.filter((m) => (activeCat === 'all' || m.category === activeCat) && (!vegOnly || m.veg) && (!q || (m.name + ' ' + m.description).toLowerCase().includes(q)));
    $('#menuEmpty').hidden = items.length > 0;
    $('#menuGrid').innerHTML = items.map((m, i) => `
      <article class="menu-item" style="animation-delay:${Math.min(i, 10) * 40}ms">
        ${img(m.image, m.name)}
        <div class="mi-body">
          <div class="mi-top"><h3><span class="dot ${m.veg ? 'veg' : 'nonveg'}" title="${m.veg ? 'Vegetarian' : 'Non-vegetarian'}"></span>${esc(m.name)}</h3><span class="price">₹${m.price}</span></div>
          <p>${esc(m.description)}</p>
          <div class="mi-foot">${m.signature ? '<span class="tag">★ Signature</span>' : '<span></span>'}
            <button class="add-btn${cart.get(m.id) ? ' added' : ''}" data-add="${m.id}">${cart.get(m.id) ? `Added ×${cart.get(m.id)}` : '+ Add'}</button></div>
        </div>
      </article>`).join('');
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => { cart.set(b.dataset.add, (cart.get(b.dataset.add) || 0) + 1); renderMenu(); updateOrderBtn(); }));
  }
  $('#menuSearch').addEventListener('input', () => renderMenu());
  $('#vegOnly').addEventListener('change', () => renderMenu());

  /* ---------- order (WhatsApp) ---------- */
  function cartCount() { let n = 0; cart.forEach((q) => (n += q)); return n; }
  function updateOrderBtn() {
    const n = cartCount();
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
  }
  $('#orderBtn').addEventListener('click', () => { if (!data) return; renderOrder(); $('#orderModal').showModal(); });
  function renderOrder() {
    const items = [...data.menu].sort((a, b) => (cart.get(b.id) || 0) - (cart.get(a.id) || 0));
    $('#orderList').innerHTML = items.map((m) => `
      <div class="order-row">${img(m.image, m.name)}<div class="name">${esc(m.name)}<small>₹${m.price}</small></div>
        <div class="qty"><button data-q="-1" data-id="${m.id}" aria-label="Remove one">−</button><span>${cart.get(m.id) || 0}</span><button data-q="1" data-id="${m.id}" aria-label="Add one">+</button></div></div>`).join('');
    $$('#orderList [data-q]').forEach((b) => b.addEventListener('click', () => {
      const v = Math.max(0, (cart.get(b.dataset.id) || 0) + +b.dataset.q);
      v ? cart.set(b.dataset.id, v) : cart.delete(b.dataset.id);
      b.parentElement.querySelector('span').textContent = v;
      totals();
    }));
    totals();
  }
  function totals() {
    let t = 0; cart.forEach((q, id) => { const m = data.menu.find((x) => x.id === id); if (m) t += m.price * q; });
    $('#orderTotal').textContent = t;
    $('#orderSend').disabled = t === 0;
    updateOrderBtn();
    renderMenu();
  }
  $('#orderSend').addEventListener('click', () => {
    let t = 0;
    const lines = [...cart].map(([id, q]) => { const m = data.menu.find((x) => x.id === id); t += m.price * q; return `• ${m.name} × ${q} = ₹${m.price * q}`; });
    const msg = `Hi ${data.settings.name}! I'd like to order:\n${lines.join('\n')}\n\nTotal: ₹${t}\nName: \nPickup / Delivery address: `;
    window.open(`https://wa.me/${data.settings.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  /* ---------- gallery ---------- */
  function renderGallery() {
    $('#galleryGrid').innerHTML = data.gallery.map((g) => `<figure data-src="${esc(g.image)}" data-cap="${esc(g.title)}" tabindex="0">${img(g.image, g.title)}<figcaption>${esc(g.title)}</figcaption></figure>`).join('');
    $$('#galleryGrid figure').forEach((f) => {
      const open = () => { $('#lightboxImg').src = f.dataset.src; $('#lightboxImg').alt = f.dataset.cap; $('#lightboxCap').textContent = f.dataset.cap; $('#lightbox').showModal(); };
      f.addEventListener('click', open);
      f.addEventListener('keydown', (e) => e.key === 'Enter' && open());
    });
  }

  /* ---------- reviews ---------- */
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  function renderReviews() {
    const r = data.reviews;
    if (r.length) {
      const avg = r.reduce((s, x) => s + x.rating, 0) / r.length;
      $('#ratingSummary').innerHTML = `<span class="stars">${stars(Math.round(avg))}</span> ${avg.toFixed(1)} from ${r.length} review${r.length > 1 ? 's' : ''}`;
    }
    $('#reviewsGrid').innerHTML = r.slice(0, 9).map((x) => `
      <article class="review"><div class="stars" aria-label="${x.rating} out of 5">${stars(x.rating)}</div><p>${esc(x.text)}</p>
        <div class="who"><span class="avatar">${esc(x.name[0]?.toUpperCase())}</span><div>${esc(x.name)}<time>${new Date(x.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</time></div></div></article>`).join('')
      || '<p class="empty">Be the first to leave a review!</p>';
  }

  let rating = 5;
  const si = $('#starsInput');
  si.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-label="${n} star${n > 1 ? 's' : ''}" data-n="${n}">★</button>`).join('');
  const paintStars = (n) => $$('button', si).forEach((b) => { b.classList.toggle('on', +b.dataset.n <= n); b.setAttribute('aria-checked', +b.dataset.n === rating); });
  $$('button', si).forEach((b) => {
    b.addEventListener('click', () => { rating = +b.dataset.n; paintStars(rating); });
    b.addEventListener('mouseenter', () => paintStars(+b.dataset.n));
  });
  si.addEventListener('mouseleave', () => paintStars(rating));
  paintStars(rating);
  $('#writeReviewBtn').addEventListener('click', () => $('#reviewModal').showModal());

  async function submit(form, url, extra = {}) {
    const msg = $('.form-msg', form);
    const body = { ...Object.fromEntries(new FormData(form)), ...extra };
    const btn = $('button[type=submit]', form);
    btn.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Sending…';
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      msg.className = 'form-msg ok'; msg.textContent = j.message; form.reset();
      return true;
    } catch (e) {
      msg.className = 'form-msg err'; msg.textContent = e.message;
    } finally { btn.disabled = false; }
  }
  $('#reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await submit(e.target, '/api/reviews', { rating })) { rating = 5; paintStars(5); }
  });

  /* ---------- reservations ---------- */
  const rf = $('#reserveForm');
  rf.date.min = new Date().toISOString().slice(0, 10);
  $$('input[name=type]', rf).forEach((r) => r.addEventListener('change', () => { $('.table-only', rf).hidden = rf.type.value !== 'table'; }));
  rf.addEventListener('submit', (e) => { e.preventDefault(); submit(rf, '/api/reservations'); });

  /* ---------- reveal on scroll ---------- */
  function reveal() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    $$('.section-head, .review, .gallery-grid figure, .visit-grid > *').forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }
})();
