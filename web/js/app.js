/* ============================================================
   PIZZERÍAS HURACANES — App de carta y pedidos (vanilla JS)
   ============================================================ */
'use strict';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const eur = n => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const STATE = {
  data: null,
  allergenMap: {},
  cart: load('hur_cart', []),
  excluded: new Set(),      // alérgenos a ocultar
  query: '',
  activeCat: null,
  spy: true,
};

function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* ---------- Arranque ---------- */
init();
async function init() {
  applyTheme(localStorage.getItem('hur_theme'));
  $('#year').textContent = new Date().getFullYear();
  try {
    const res = await fetch('data/menu.json');
    STATE.data = await res.json();
  } catch (e) {
    $('#menuRoot').innerHTML = '<p style="padding:40px 0;color:var(--ink-faint)">No se pudo cargar la carta. Recarga la página.</p>';
    return;
  }
  STATE.allergenMap = Object.fromEntries(STATE.data.allergenLegend.map(a => [a.key, a]));
  buildSEO();
  renderChips();
  renderAllergenFilter();
  renderMenu();
  renderFeatured();
  renderLocations();
  renderFooterCats();
  renderLegend();
  wire();
  updateCartUI();
  setupScrollSpy();
  setupReveal();
}

/* ---------- SEO / JSON-LD ---------- */
function buildSEO() {
  const r = STATE.data.restaurant;
  const menuSections = STATE.data.categories.map(c => ({
    '@type': 'MenuSection', name: c.name,
    hasMenuItem: c.items.slice(0, 40).map(it => ({
      '@type': 'MenuItem', name: it.name,
      description: it.description || undefined,
      offers: { '@type': 'Offer', price: (it.price ?? (it.sizes && it.sizes[0].price) ?? 0).toFixed(2), priceCurrency: 'EUR' }
    }))
  }));
  const ld = {
    '@context': 'https://schema.org', '@type': 'Restaurant',
    name: r.name, servesCuisine: ['Pizza', 'Italiana'], priceRange: '€€',
    telephone: '+34' + r.phoneRaw,
    address: r.locations.map(l => ({ '@type': 'PostalAddress', streetAddress: l.address, addressLocality: l.zip, addressCountry: 'ES' })),
    acceptsReservations: 'True',
    hasMenu: { '@type': 'Menu', hasMenuSection: menuSections }
  };
  $('#ld-restaurant').textContent = JSON.stringify(ld);
}

/* ---------- Chips categorías ---------- */
function renderChips() {
  const el = $('#chips');
  el.innerHTML = STATE.data.categories.map(c =>
    `<button class="chip" data-cat="${c.id}"><span class="emoji">${c.emoji}</span>${c.name}</button>`
  ).join('');
  el.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const target = $('#cat-' + b.dataset.cat);
    if (target) {
      STATE.spy = false;
      setActiveChip(b.dataset.cat);
      const y = target.getBoundingClientRect().top + window.scrollY - (document.querySelector('.header').offsetHeight + document.querySelector('.menu-toolbar').offsetHeight + 10);
      window.scrollTo({ top: y, behavior: 'smooth' });
      setTimeout(() => STATE.spy = true, 700);
    }
  });
}
function setActiveChip(id) {
  $$('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.cat === id));
  const active = $(`#chips .chip[data-cat="${id}"]`);
  if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

/* ---------- Filtro alérgenos ---------- */
function renderAllergenFilter() {
  $('#allergenChips').innerHTML = STATE.data.allergenLegend.map(a =>
    `<button class="achip" data-key="${a.key}"><span>${a.icon}</span>${a.name}</button>`
  ).join('');
  $('#allergenChips').addEventListener('click', e => {
    const b = e.target.closest('.achip'); if (!b) return;
    const k = b.dataset.key;
    if (STATE.excluded.has(k)) STATE.excluded.delete(k); else STATE.excluded.add(k);
    b.classList.toggle('active');
    $('#filterDot').classList.toggle('hidden', STATE.excluded.size === 0);
    $('#filterBtn').classList.toggle('active', STATE.excluded.size > 0);
    renderMenu();
  });
}

/* ---------- Render carta ---------- */
function matchItem(it) {
  const q = STATE.query.trim().toLowerCase();
  if (q) {
    const hay = (it.name + ' ' + (it.description || '')).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (STATE.excluded.size) {
    if ((it.allergens || []).some(a => STATE.excluded.has(a))) return false;
  }
  return true;
}

function renderMenu() {
  const root = $('#menuRoot');
  let html = '';
  let anyResult = false;
  const FEATURED = new Set(['Margarita', 'Bacon', 'Hurriburguer', 'Pepperoni', 'Barbacoa']);

  for (const cat of STATE.data.categories) {
    const items = cat.items.filter(matchItem);
    if (!items.length) continue;
    anyResult = true;
    const subtitle = cat.type === 'pizza'
      ? `${cat.items.length} pizzas · tres tamaños (26 / 34 / 45 cm)`
      : `${cat.items.length} opciones`;
    html += `<div class="cat-block" id="cat-${cat.id}" data-cat="${cat.id}">
      <div class="cat-title"><span class="emoji">${cat.emoji}</span><h3>${cat.name}</h3></div>
      <div class="cat-sub">${subtitle}</div>
      <div class="grid">${items.map(it => cat.type === 'pizza' ? pizzaCard(it) : simpleCard(it, cat)).join('')}</div>
    </div>`;
  }
  root.innerHTML = html;
  $('#noResults').classList.toggle('hidden', anyResult);
  bindCards();
}

function allergenIcons(list) {
  if (!list || !list.length) return '';
  return `<div class="allergen-row">${list.map(k => {
    const a = STATE.allergenMap[k]; return a ? `<span class="a" title="${a.name}">${a.icon}</span>` : '';
  }).join('')}</div>`;
}

function photo(it, cls) {
  if (it.image) return `<div class="card-photo ${cls || ''}"><img loading="lazy" src="${it.image}" alt="${it.name}"></div>`;
  return `<div class="card-photo noimg ${cls || ''}">🍕</div>`;
}

function simpleCard(it, cat) {
  return `<article class="card ${it.unavailable ? 'unavailable' : ''}" data-id="${it.id}">
    ${photo(it)}
    <div class="card-body">
      <div class="card-name">${it.name}</div>
      ${it.description ? `<div class="card-desc">${it.description}</div>` : ''}
      ${allergenIcons(it.allergens)}
      <div class="card-foot">
        <div class="price">${it.txtPrice || eur(it.price)}</div>
        <button class="add-btn" data-add="${it.id}" data-cat="${cat.id}" aria-label="Añadir ${it.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}

function pizzaCard(it) {
  const sizes = it.sizes.map((s, i) =>
    `<button class="size-opt ${i === 0 ? 'active' : ''}" data-size="${i}">
      <b>${s.label}</b><span>${s.sub}</span><span class="sp">${s.txtPrice}</span>
    </button>`).join('');
  const tag = /margarita|bacon|barbacoa|hurri/i.test(it.name) ? '<span class="badge-tag">Top</span>' : '';
  return `<article class="card ${it.unavailable ? 'unavailable' : ''}" data-id="${it.id}" data-pizza="1">
    ${tag}
    ${photo(it)}
    <div class="card-body">
      <div class="card-name">${it.name}</div>
      ${it.description ? `<div class="card-desc">${it.description}</div>` : ''}
      ${allergenIcons(it.allergens)}
      <div class="sizes">${sizes}</div>
      <div class="card-foot">
        <div class="price" data-price>${it.sizes[0].txtPrice} <small>${it.sizes[0].label}</small></div>
        <button class="add-btn" data-add="${it.id}" data-pizza aria-label="Añadir ${it.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}

function bindCards() {
  // selector de tamaño pizza
  $$('.card[data-pizza] .sizes').forEach(sizes => {
    sizes.addEventListener('click', e => {
      const b = e.target.closest('.size-opt'); if (!b) return;
      const card = b.closest('.card');
      const idx = +b.dataset.size;
      $$('.size-opt', sizes).forEach(o => o.classList.remove('active'));
      b.classList.add('active');
      const it = findItem(card.dataset.id);
      const s = it.sizes[idx];
      $('[data-price]', card).innerHTML = `${s.txtPrice} <small>${s.label}</small>`;
    });
  });
  // añadir al carrito
  $$('.add-btn[data-add]').forEach(btn => {
    btn.addEventListener('click', e => {
      const card = btn.closest('.card');
      const it = findItem(btn.dataset.add);
      if (btn.hasAttribute('data-pizza')) {
        const idx = +($('.size-opt.active', card)?.dataset.size || 0);
        const s = it.sizes[idx];
        addToCart({ key: it.id + '_' + s.code, name: it.name, variant: s.label, price: s.price, image: it.image, productId: s.productId });
      } else {
        addToCart({ key: it.id, name: it.name, variant: '', price: it.price, image: it.image, productId: it.productId });
      }
      flyToCart(card.querySelector('.card-photo'));
    });
  });
}

function findItem(id) {
  for (const c of STATE.data.categories) {
    const f = c.items.find(i => i.id === id);
    if (f) return f;
  }
  return null;
}

/* ---------- Destacados ---------- */
function renderFeatured() {
  const picks = [];
  const wanted = ['Bacon', 'Hurriburguer', 'Barbacoa', 'Pepperoni', 'Burrata', 'Musaka', 'Tropical'];
  for (const w of wanted) {
    for (const c of STATE.data.categories) {
      const it = c.items.find(i => i.name.toLowerCase().includes(w.toLowerCase()) && i.image);
      if (it && !picks.find(p => p.it === it)) { picks.push({ it, cat: c }); break; }
    }
  }
  // rellenar con cualquier item con imagen
  if (picks.length < 6) {
    for (const c of STATE.data.categories) {
      for (const it of c.items) {
        if (it.image && !picks.find(p => p.it === it)) picks.push({ it, cat: c });
        if (picks.length >= 8) break;
      }
      if (picks.length >= 8) break;
    }
  }
  $('#railFeatured').innerHTML = picks.slice(0, 8).map(({ it, cat }) => {
    const price = it.sizes ? it.sizes[0].txtPrice + ' <small style="color:var(--ink-faint);font-weight:600">' + it.sizes[0].label + '</small>' : (it.txtPrice || eur(it.price));
    return `<div class="fcard">
      <div class="fcard-img"><img loading="lazy" src="${it.image}" alt="${it.name}"></div>
      <div class="fcard-body">
        <h4>${it.name}</h4>
        <p>${it.description || cat.name}</p>
        <div class="fcard-foot">
          <div class="price">${price}</div>
          <a href="#cat-${cat.id}" class="btn btn-cyan" style="padding:8px 14px;font-size:13px">Ver</a>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Locales ---------- */
function renderLocations() {
  $('#locations').innerHTML = STATE.data.restaurant.locations.map(l => `
    <div class="loc-card reveal">
      <h3><span class="pin"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10z"/><circle cx="12" cy="11" r="2.5"/></svg></span>${l.name}</h3>
      <div class="addr">${l.address}<br>${l.zip}</div>
      <div class="loc-actions">
        <a href="${l.order}" target="_blank" rel="noopener" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 3l14 9-14 9V3z"/></svg> Pedir online</a>
        <a href="${l.maps}" target="_blank" rel="noopener" class="btn btn-ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10z"/><circle cx="12" cy="11" r="2.5"/></svg> Cómo llegar</a>
        <a href="tel:${STATE.data.restaurant.phoneRaw}" class="btn btn-ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" stroke-linecap="round" stroke-linejoin="round"/></svg> Llamar</a>
      </div>
    </div>
  `).join('');
}

function renderFooterCats() {
  $('#footerCats').innerHTML = STATE.data.categories.map(c =>
    `<li><a href="#cat-${c.id}">${c.emoji} ${c.name}</a></li>`).join('');
}
function renderLegend() {
  $('#legendList').innerHTML = STATE.data.allergenLegend.map(a =>
    `<div class="leg-item"><span class="a">${a.icon}</span> ${a.name}</div>`).join('');
}

/* ---------- Carrito ---------- */
function addToCart(item) {
  const ex = STATE.cart.find(c => c.key === item.key);
  if (ex) ex.qty++; else STATE.cart.push({ ...item, qty: 1 });
  save('hur_cart', STATE.cart);
  updateCartUI();
  toast(`Añadido: ${item.name}${item.variant ? ' · ' + item.variant : ''}`);
}
function changeQty(key, d) {
  const it = STATE.cart.find(c => c.key === key); if (!it) return;
  it.qty += d;
  if (it.qty <= 0) STATE.cart = STATE.cart.filter(c => c.key !== key);
  save('hur_cart', STATE.cart);
  updateCartUI(); renderCart();
}
function cartTotal() { return STATE.cart.reduce((s, i) => s + i.price * i.qty, 0); }
function cartCount() { return STATE.cart.reduce((s, i) => s + i.qty, 0); }

function updateCartUI() {
  const n = cartCount();
  const badge = $('#cartCount');
  badge.textContent = n;
  badge.classList.toggle('show', n > 0);
  $('#bottomCartLabel').textContent = n > 0 ? `Pedido · ${eur(cartTotal())}` : 'Mi pedido';
}

function renderCart() {
  const body = $('#cartBody'), foot = $('#cartFoot');
  if (!STATE.cart.length) {
    body.innerHTML = `<div class="cart-empty"><div class="em">🛒</div><p>Tu pedido está vacío.<br>Añade platos desde la carta.</p></div>`;
    foot.innerHTML = `<a href="#carta" class="btn btn-primary btn-block" id="goCarta">Ver la carta</a>`;
    $('#goCarta').addEventListener('click', closeDrawer);
    return;
  }
  body.innerHTML = STATE.cart.map(it => `
    <div class="citem">
      <div class="citem-img">${it.image ? `<img src="${it.image}" alt="">` : '🍕'}</div>
      <div class="citem-info">
        <h4>${it.name}</h4>
        ${it.variant ? `<div class="meta">${it.variant}</div>` : ''}
        <div class="cprice">${eur(it.price * it.qty)}</div>
        <div class="qty">
          <button data-dec="${it.key}" aria-label="Quitar uno">−</button>
          <span>${it.qty}</span>
          <button data-inc="${it.key}" aria-label="Añadir uno">+</button>
        </div>
      </div>
    </div>`).join('');
  body.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => changeQty(b.dataset.inc, 1));
  body.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => changeQty(b.dataset.dec, -1));

  foot.innerHTML = `
    <div class="cart-total"><span class="lbl">Total estimado</span><span class="val">${eur(cartTotal())}</span></div>
    <p class="cart-note">Precios de carta. Confirma tu pedido con el local para recogida o envío a domicilio.</p>
    <button class="btn btn-primary btn-block btn-lg" id="checkout">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Enviar pedido
    </button>
    <button class="btn btn-ghost btn-block" id="clearCart" style="margin-top:8px">Vaciar pedido</button>`;
  $('#checkout').onclick = openOrderModal;
  $('#clearCart').onclick = () => { STATE.cart = []; save('hur_cart', STATE.cart); updateCartUI(); renderCart(); };
}

/* ---------- Envío de pedido (WhatsApp / local) ---------- */
function buildOrderText(loc) {
  let t = `¡Hola! Quiero hacer un pedido en *Pizzerías Huracanes*`;
  if (loc) t += ` (${loc.name})`;
  t += `:\n\n`;
  for (const it of STATE.cart) t += `• ${it.qty}× ${it.name}${it.variant ? ' (' + it.variant + ')' : ''} — ${eur(it.price * it.qty)}\n`;
  t += `\n*Total estimado: ${eur(cartTotal())}*\n\n`;
  t += `Indícame por favor si es para recoger o a domicilio. ¡Gracias!`;
  return t;
}
function openOrderModal() {
  const r = STATE.data.restaurant;
  const body = $('#orderModalBody');
  body.innerHTML = `
    <p>Tu pedido está listo. Elige el local y cómo prefieres enviarlo. Te contestamos para confirmar tiempo y forma de entrega.</p>
    ${r.locations.map(l => `
      <div style="border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:12px">
        <div style="font-weight:800;font-size:16px;margin-bottom:2px">${l.name}</div>
        <div style="color:var(--ink-faint);font-size:13px;margin-bottom:12px">${l.address} · ${l.zip}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-cyan" style="flex:1;min-width:130px" href="https://wa.me/?text=${encodeURIComponent(buildOrderText(l))}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.2-4.9-4.4-.1-.2-1.1-1.5-1.1-2.9 0-1.3.7-2 .9-2.3.3-.3.6-.3.8-.3h.6c.2 0 .5-.1.7.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.4.4-.2.7.2.4.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.3z"/></svg>
            Pedir por WhatsApp
          </a>
          <a class="btn btn-primary" style="flex:1;min-width:130px" href="${l.order}" target="_blank" rel="noopener">Pedido online</a>
        </div>
        <a class="btn btn-ghost btn-block" style="margin-top:8px" href="tel:${r.phoneRaw}">Llamar al ${r.phone}</a>
      </div>`).join('')}
    <p style="font-size:12px;color:var(--ink-faint)">El botón de WhatsApp abre un mensaje con tu pedido ya escrito para que solo tengas que enviarlo al número del local.</p>`;
  $('#orderModal').classList.add('open');
}

/* ---------- Drawer / modales ---------- */
function openDrawer() { renderCart(); $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); document.body.style.overflow = ''; }

/* ---------- Animación fly-to-cart ---------- */
function flyToCart(sourceEl) {
  if (!sourceEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = (window.innerWidth < 860 ? $('#cartBtnBottom') : $('#cartBtn'));
  if (!target) return;
  const s = sourceEl.getBoundingClientRect(), t = target.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'flyer';
  const img = sourceEl.querySelector('img');
  fly.style.cssText = `left:${s.left}px;top:${s.top}px;width:${s.width}px;height:${s.height}px;` +
    (img ? `background-image:url(${img.src});background-size:cover;` : 'background:var(--cyan);');
  fly.style.setProperty('--fx', (t.left + t.width / 2 - s.left - s.width / 2) + 'px');
  fly.style.setProperty('--fy', (t.top + t.height / 2 - s.top - s.height / 2) + 'px');
  document.body.appendChild(fly);
  setTimeout(() => fly.remove(), 620);
}

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1900);
}

/* ---------- Tema ---------- */
function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  updateThemeIcon();
}
function updateThemeIcon() {
  const dark = document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#themeIcon').innerHTML = dark
    ? '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'
    : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
}

/* ---------- Scroll spy ---------- */
function setupScrollSpy() {
  const opts = { rootMargin: `-${document.querySelector('.header').offsetHeight + 130}px 0px -65% 0px`, threshold: 0 };
  const obs = new IntersectionObserver(entries => {
    if (!STATE.spy) return;
    for (const e of entries) if (e.isIntersecting) setActiveChip(e.target.dataset.cat);
  }, opts);
  const watch = () => $$('.cat-block').forEach(b => obs.observe(b));
  watch();
  STATE._reobserve = () => { obs.disconnect(); watch(); };
}

/* ---------- Reveal on scroll ---------- */
function setupReveal() {
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach(el => obs.observe(el));
}

/* ---------- Wiring ---------- */
function wire() {
  $('#cartBtn').onclick = openDrawer;
  $('#cartBtnBottom').onclick = openDrawer;
  $('#closeDrawer').onclick = closeDrawer;
  $('#overlay').onclick = closeDrawer;

  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('hur_theme', next);
    updateThemeIcon();
  };

  const search = $('#searchInput');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { STATE.query = search.value; renderMenu(); STATE._reobserve && STATE._reobserve(); }, 160);
  });

  $('#filterBtn').onclick = () => $('#filtersPanel').classList.toggle('open');

  $('#allergenLink').onclick = e => { e.preventDefault(); $('#allergenModal').classList.add('open'); };
  $('#closeAllergen').onclick = () => $('#allergenModal').classList.remove('open');
  $('#closeOrder').onclick = () => $('#orderModal').classList.remove('open');
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); $$('.modal').forEach(m => m.classList.remove('open')); }
  });

  const header = $('#header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
}
