/* Beheeromgeving voor de ondernemer. Alle wijzigingen gaan via de beveiligde
   beheer-API (sessiecookie + CSRF-token). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const put = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  let csrf = null;
  let me = null;
  let tab = (location.hash || '#orders').slice(1);
  let refreshTimer = null;
  let seenOrders = new Set();

  // ---------- hulpfuncties ----------
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }
  const money = (c) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format((c || 0) / 100);
  const euroInput = (c) => ((c || 0) / 100).toFixed(2).replace('.', ',');
  function parseEuro(s) {
    const v = String(s).trim().replace(/\s|€/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN;
    return Math.round(Number(v) * 100);
  }
  const dateNl = (d) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd)));
  };
  const dt = (iso) => iso ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)) : '';
  const DAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '0'];
  const ST = { received: 'Ontvangen', preparing: 'In voorbereiding', ready: 'Klaar', picked_up: 'Afgehaald', out_for_delivery: 'Onderweg', delivered: 'Bezorgd', cancelled: 'Geannuleerd', pending_payment: 'Wacht op betaling' };
  const PS = { paid: 'Online betaald', pay_at_pickup: 'Betalen bij afhalen', paid_at_pickup: 'Betaald bij afhalen', pay_on_delivery: 'Betalen bij bezorging', paid_on_delivery: 'Betaald bij bezorging', open: 'Betaling open', not_started: 'Betaling niet gestart', failed: 'Betaling mislukt', canceled: 'Betaling geannuleerd', expired: 'Betaling verlopen' };
  const AL = { gluten: 'Gluten', crustaceans: 'Schaaldieren', eggs: 'Ei', fish: 'Vis', peanuts: "Pinda's", soy: 'Soja', milk: 'Melk (lactose)', nuts: 'Noten', celery: 'Selderij', mustard: 'Mosterd', sesame: 'Sesam', sulphites: 'Sulfiet', lupin: 'Lupine', molluscs: 'Weekdieren' };
  const DI = { vegetarian: 'Vegetarisch', vegan: 'Veganistisch' };
  const ERR = {
    invalid_login: 'E-mailadres of wachtwoord klopt niet.',
    account_locked: 'Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.',
    rate_limited: 'Te veel pogingen. Wacht even.',
    not_logged_in: 'Je bent uitgelogd. Log opnieuw in.',
    csrf_failed: 'Sessie verlopen. Herlaad de pagina.',
    invalid_transition: 'Deze statuswijziging is niet mogelijk.',
    weak_password: 'Wachtwoord te zwak.',
    network: 'Geen verbinding met de server. Er is niets opgeslagen.',
  };

  async function api(path, opts = {}) {
    const headers = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.method && opts.method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf;
    let res;
    try {
      res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' });
    } catch {
      throw Object.assign(new Error(ERR.network), { code: 'network' });
    }
    let data = null;
    try { data = await res.json(); } catch { /* leeg */ }
    if (!res.ok) {
      const code = data?.error?.code || 'server_error';
      if (res.status === 401 && code === 'not_logged_in' && !path.endsWith('/login')) showLogin();
      throw Object.assign(new Error(data?.error?.message || ERR[code] || `Er ging iets mis (${code}). Er is niets opgeslagen.`), { code, details: data?.error?.details });
    }
    return data;
  }

  function flash(text, kind = 'success') {
    const f = $('flash');
    put(f, el('p', { class: kind, text }));
    clearTimeout(flash.t);
    flash.t = setTimeout(() => put(f, ), kind === 'success' ? 3500 : 9000);
  }
  async function guarded(fn, okText) {
    try {
      const r = await fn();
      if (okText) flash(okText);
      return r;
    } catch (e) {
      flash(e.message, 'alert');
      return undefined;
    }
  }

  function field(label, input, hint) {
    const id = input.id || ('f' + Math.random().toString(36).slice(2));
    input.id = id;
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), input, hint ? el('p', { class: 'hint', text: hint }) : null);
  }
  const input = (name, value, attrs = {}) => el('input', { name, type: 'text', value: value ?? '', ...attrs });
  const textarea = (name, value, attrs = {}) => { const t = el('textarea', { name, ...attrs }); t.value = value ?? ''; return t; };
  const check = (name, checked, label) => el('label', { class: 'switch' }, el('input', { type: 'checkbox', name, checked }), label);

  function dialog(title, body, actions) {
    $('admin-dialog-title').textContent = title;
    put($('admin-dialog-body'), body);
    put($('admin-dialog-foot'), ...actions);
    $('admin-dialog').showModal();
  }
  $('admin-dialog-close').onclick = () => $('admin-dialog').close();
  const closeDialog = () => $('admin-dialog').close();

  // Afbeelding uploaden: bestand → base64 → server (alleen JPG/PNG/WebP, max. 5 MB)
  function pickImage() {
    return new Promise((resolve) => {
      const f = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      f.onchange = () => {
        const file = f.files[0];
        if (!file) return resolve(null);
        if (file.size > 5 * 1024 * 1024) { flash('Afbeelding is groter dan 5 MB. Verklein de foto eerst.', 'alert'); return resolve(null); }
        const r = new FileReader();
        r.onload = async () => {
          const data = String(r.result).split(',')[1];
          const res = await guarded(() => api('/api/admin/uploads', { method: 'POST', body: { data } }), 'Afbeelding geüpload.');
          resolve(res ? res.url : null);
        };
        r.readAsDataURL(file);
      };
      f.click();
    });
  }

  // ---------- inloggen ----------
  function showLogin() {
    clearInterval(refreshTimer);
    $('app-view').hidden = true;
    $('login-view').hidden = false;
    $('login-email').focus();
  }
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').hidden = true;
    try {
      const r = await api('/api/admin/login', { method: 'POST', body: { email: $('login-email').value, password: $('login-password').value } });
      csrf = r.csrf;
      $('login-password').value = '';
      await start();
    } catch (err) {
      $('login-error').hidden = false;
      $('login-error').textContent = err.message;
    }
  });

  async function start() {
    try {
      const r = await api('/api/admin/me');
      csrf = r.csrf;
      me = r;
    } catch {
      showLogin();
      return;
    }
    $('demo-banner').hidden = !me.demo;
    $('login-view').hidden = true;
    $('app-view').hidden = false;
    show(tab);
  }

  document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => show(b.dataset.tab); });
  window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'orders'));

  function show(name) {
    if (!VIEWS[name]) name = 'orders';
    tab = name;
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false'));
    clearInterval(refreshTimer);
    put($('view'), el('p', { class: 'muted', text: 'Laden…' }));
    VIEWS[name]().catch((e) => put($('view'), el('p', { class: 'alert', text: e.message })));
    updatePauseIndicator();
  }

  async function updatePauseIndicator() {
    try {
      const s = await api('/api/site');
      $('pause-indicator').hidden = !s.ordering.paused;
    } catch { /* niet kritiek */ }
  }

  // ---------- bestellingen ----------
  // Standaard: alle openstaande bestellingen, ook vooruitbestellingen voor latere dagen.
  const ordersState = { date: '', status: 'open', fulfillment: '' };

  async function viewOrders() {
    const sys = await api('/api/admin/system');
    const dateIn = el('input', { type: 'date', value: ordersState.date || sys.today });
    const statusSel = el('select', {},
      ...[['open', 'Openstaand'], ['all', 'Alles'], ['pending_payment', 'Wacht op betaling'], ['out_for_delivery', 'Onderweg'], ['picked_up', 'Afgehaald'], ['delivered', 'Bezorgd'], ['cancelled', 'Geannuleerd']]
        .map(([v, l]) => el('option', { value: v, selected: v === ordersState.status ? true : null, text: l })));
    statusSel.value = ordersState.status;
    const modeSel = el('select', {},
      el('option', { value: '', text: 'Afhalen en bezorgen' }), el('option', { value: 'pickup', text: 'Alleen afhalen' }), el('option', { value: 'delivery', text: 'Alleen bezorgen' }));
    modeSel.value = ordersState.fulfillment;
    modeSel.onchange = () => { ordersState.fulfillment = modeSel.value; refresh(); };
    const anyDate = el('input', { type: 'checkbox' });
    anyDate.checked = ordersState.date === '';
    const list = el('div', { class: 'order-cards' });
    const slotbar = el('div', {});
    const pauseBtn = el('button', { type: 'button', class: 'btn btn-small' });

    async function refresh() {
      const q = new URLSearchParams({ date: ordersState.date, status: ordersState.status, fulfillment: ordersState.fulfillment });
      let data;
      try { data = await api('/api/admin/orders?' + q); } catch (e) { put(list, el('p', { class: 'alert', text: e.message })); return; }
      const fresh = data.orders.filter((o) => !seenOrders.has(o.id));
      const firstLoad = seenOrders.size === 0;
      data.orders.forEach((o) => seenOrders.add(o.id));
      put(list, ...(data.orders.length ? data.orders.map((o) => orderCard(o, !firstLoad && fresh.includes(o), refresh)) : [el('p', { class: 'muted', text: 'Geen bestellingen voor deze selectie.' })]));
      const open = data.orders.filter((o) => ['received', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length;
      document.title = (open ? `(${open}) ` : '') + 'Beheer';
      let site = null;
      try {
        site = await api('/api/site');
        pauseBtn.textContent = site.ordering.paused ? '▶ Online bestellen hervatten' : '⏸ Online bestellen pauzeren';
        pauseBtn.className = 'btn btn-small' + (site.ordering.paused ? ' btn-primary' : '');
      } catch { /* knoptekst volgt bij volgende verversing */ }
      if (ordersState.date && site) {
        // Vrije plekken per tijdvak, apart voor afhalen en bezorgen.
        const modes = [['pickup', 'Afhalen', site.ordering.pickup_enabled], ['delivery', 'Bezorgen', site.ordering.delivery_enabled]]
          .filter(([m, , on]) => on && (!ordersState.fulfillment || ordersState.fulfillment === m));
        const rows = [];
        for (const [m, label] of modes) {
          try {
            const day = await api(`/api/admin/slots?date=${ordersState.date}&mode=${m}`);
            rows.push(el('div', { class: 'slotbar' }, el('strong', { class: 'small', text: `${label}:` }),
              ...(day.slots.length ? day.slots.map((s) => el('span', {
                class: s.remaining === 0 ? 'full' : s.available && s.remaining <= 1 ? 'busy' : '',
                title: `${s.remaining} plek(ken) vrij`, text: `${s.time} · ${s.remaining} vrij`,
              })) : [el('span', { class: 'full', text: day.reason === 'closure' ? 'Sluitingsdag' : day.reason === 'closed_day' ? 'Geen tijden (gesloten)' : 'Geen (resterende) tijden' })])));
          } catch { /* overzicht optioneel */ }
        }
        put(slotbar, ...rows);
      } else put(slotbar);
    }

    pauseBtn.onclick = async () => {
      const s = await api('/api/admin/settings');
      const paused = !s.ordering.paused;
      if (paused && !confirm('Online bestellen pauzeren? Klanten kunnen dan niet meer bestellen tot je hervat.')) return;
      await guarded(() => api('/api/admin/settings/ordering', { method: 'PUT', body: { ...s.ordering, paused } }), paused ? 'Online bestellen is gepauzeerd.' : 'Online bestellen is hervat.');
      updatePauseIndicator();
      refresh();
    };
    dateIn.onchange = () => { ordersState.date = dateIn.value; anyDate.checked = false; refresh(); };
    anyDate.onchange = () => { ordersState.date = anyDate.checked ? '' : (dateIn.value || sys.today); refresh(); };
    statusSel.onchange = () => { ordersState.status = statusSel.value; refresh(); };

    put($('view'), 
      el('div', { class: 'toolbar' },
        field('Dag', dateIn),
        el('label', { class: 'switch' }, anyDate, 'Alle dagen'),
        field('Tonen', statusSel),
        field('Soort', modeSel),
        el('button', { type: 'button', class: 'btn btn-small', onclick: refresh }, '↻ Vernieuwen'),
        el('span', { class: 'grow' }),
        pauseBtn),
      slotbar,
      el('p', { class: 'small muted', text: 'De lijst ververst elke 30 seconden. Bestellingen staan altijd hier, ook als een e-mailmelding niet aankomt.' }),
      list);
    await refresh();
    refreshTimer = setInterval(refresh, 30000);
  }

  function orderCard(o, isNew, refresh) {
    const done = ['picked_up', 'delivered', 'cancelled'].includes(o.status);
    const a = o.address;
    const route = a ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${a.street} ${a.house_number}, ${a.postcode} ${a.city}`)}` : '';
    const act = async (path, body, msg) => { if (await guarded(() => api(path, { method: 'POST', body }), msg)) refresh(); };
    const buttons = o.allowed_status.map((s) => el('button', {
      type: 'button', class: 'btn btn-small' + (s === 'cancelled' ? ' btn-ghost' : ''),
      onclick: () => {
        if (s === 'cancelled' && !confirm(`Bestelling ${o.number} annuleren?${o.payment_status === 'paid' ? '\n\nDeze bestelling is online betaald: betaal het bedrag zelf terug via het dashboard van je betaalprovider.' : ''}`)) return;
        act(`/api/admin/orders/${o.id}/status`, { status: s }, `Status: ${ST[s]}`);
      },
    }, s === 'cancelled' ? 'Annuleren' : `→ ${ST[s]}`));
    if (['pay_at_pickup', 'pay_on_delivery'].includes(o.payment_status) && o.status !== 'cancelled') {
      buttons.push(el('button', { type: 'button', class: 'btn btn-small', onclick: () => act(`/api/admin/orders/${o.id}/paid-at-pickup`, {}, 'Gemarkeerd als betaald.') },
        o.payment_status === 'pay_on_delivery' ? '€ Betaald bij bezorging' : '€ Betaald bij afhalen'));
    }
    buttons.push(el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => orderDetail(o.id) }, 'Details'));
    return el('article', { class: `order-card${o.needs_attention ? ' attention' : ''}${isNew ? ' new' : ''}${done ? ' done' : ''}` },
      el('div', { class: 'row' },
        el('h3', {}, el('span', { class: `mode-badge ${o.fulfillment}`, text: o.fulfillment === 'delivery' ? 'Bezorgen' : 'Afhalen' }), ' ',
          `${o.number} · ${dateNl(o.pickup_date)} ${o.pickup_time}`),
        el('div', { class: 'pill-row' },
          el('span', { class: `status-pill ${o.status === 'cancelled' ? 'err' : o.status === 'pending_payment' ? 'warn' : 'ok'}`, text: ST[o.status] || o.status }),
          el('span', { class: `status-pill ${['paid', 'paid_at_pickup', 'paid_on_delivery'].includes(o.payment_status) ? 'ok' : ['failed', 'canceled', 'expired'].includes(o.payment_status) ? 'err' : ''}`, text: PS[o.payment_status] || o.payment_status }))),
      a ? el('p', { class: 'notice' }, el('strong', { text: 'Bezorgadres: ' }), `${a.street} ${a.house_number}, ${a.postcode} ${a.city}`,
        a.zone ? el('span', { class: 'muted small', text: ` (${a.zone})` }) : null, ' · ',
        el('a', { href: route, target: '_blank', rel: 'noopener', text: 'Route' })) : null,
      isNew ? el('p', { class: 'small', text: '● Nieuw' }) : null,
      o.needs_attention ? el('div', { class: 'alert' }, el('strong', { text: 'Let op: ' }), o.needs_attention, ' ',
        el('button', { type: 'button', class: 'btn btn-small', onclick: () => act(`/api/admin/orders/${o.id}/resolve`, {}, 'Melding afgehandeld.') }, 'Afgehandeld')) : null,
      el('p', {}, el('strong', { text: o.customer_name }), ' · ', el('a', { href: `tel:${o.customer_phone.replace(/[^\d+]/g, '')}`, text: o.customer_phone }), ' · ', el('a', { href: `mailto:${o.customer_email}`, text: o.customer_email })),
      el('ul', {}, o.items.map((i) => el('li', {}, `${i.quantity}× ${i.name}`, i.options.length ? ` (${i.options.join(', ')})` : '', i.note ? ` – “${i.note}”` : ''))),
      o.note ? el('p', { class: 'notice', text: `Opmerking: ${o.note}` }) : null,
      el('p', {}, el('strong', { text: `Totaal ${money(o.total_cents)}` }), o.fee_cents ? el('span', { class: 'muted small', text: ` (incl. ${o.fee_label} ${money(o.fee_cents)})` }) : null,
        o.delivery_fee_cents ? el('span', { class: 'muted small', text: ` (incl. bezorgkosten ${money(o.delivery_fee_cents)})` }) : null,
        o.is_demo ? el('span', { class: 'muted small', text: ' · demobestelling' }) : null),
      el('div', { class: 'actions' }, buttons));
  }

  async function orderDetail(id) {
    const o = await guarded(() => api('/api/admin/orders/' + id));
    if (!o) return;
    const body = el('div', {},
      el('p', {}, `Geplaatst: ${dt(o.created_at)}`, o.paid_at ? ` · Betaald: ${dt(o.paid_at)}` : '', ` · Taal: ${o.lang.toUpperCase()}`),
      el('h3', { text: 'Betalingen' }),
      o.payments.length ? el('div', { class: 'table-scroll' }, el('table', { class: 'admin-table' },
        el('thead', {}, el('tr', {}, ...['Provider', 'Kenmerk', 'Status', 'Bedrag', 'Bijgewerkt'].map((h) => el('th', { text: h })))),
        el('tbody', {}, o.payments.map((p) => el('tr', {}, el('td', { text: p.provider }), el('td', { text: p.provider_payment_id }), el('td', { text: p.status }), el('td', { text: money(p.amount_cents) }), el('td', { text: dt(p.updated_at) })))))) : el('p', { class: 'muted', text: 'Geen online betaling.' }),
      el('h3', { text: 'E-mails' }),
      o.mails.length ? el('ul', {}, o.mails.map((m) => el('li', {}, `${m.kind === 'customer_confirmation' ? 'Klant' : 'Zaak'} (${m.to_addr}): ${mailStatus(m.status)}${m.error ? ' – ' + m.error : ''}`))) : el('p', { class: 'muted', text: 'Nog geen e-mails (wordt verstuurd zodra de bestelling definitief is).' }),
      el('h3', { text: 'Logboek' }),
      el('ul', { class: 'small' }, o.events.map((ev) => el('li', {}, `${dt(ev.at)} – ${ev.type}${ev.detail ? ': ' + ev.detail : ''}`))));
    dialog(`Bestelling ${o.number}`, body, [el('button', { type: 'button', class: 'btn', onclick: closeDialog }, 'Sluiten')]);
  }
  const mailStatus = (s) => ({ sent: 'verzonden', pending: 'in wachtrij', failed: 'mislukt', not_configured: 'niet verzonden (geen e-mailprovider ingesteld)', demo_not_sent: 'niet verzonden (demo)' }[s] || s);

  // ---------- menukaart ----------
  async function viewMenu() {
    const data = await api('/api/admin/catalog');
    const blocks = data.categories.map((c) => el('section', { class: 'cat-block' },
      el('div', { class: 'row' },
        el('h3', { text: c.name.nl + (c.active ? '' : ' (verborgen)') }),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => editCategory(c) }, 'Categorie wijzigen'),
        el('button', { type: 'button', class: 'btn btn-small', onclick: () => editProduct(null, c.id, data) }, '+ Gerecht')),
      c.products.length ? c.products.map((p) => productRow(p, data)) : el('p', { class: 'muted small', text: 'Nog geen gerechten.' })));
    put($('view'), 
      el('div', { class: 'toolbar' },
        el('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: () => editCategory(null) }, '+ Categorie'),
        el('p', { class: 'small muted', text: 'Eén centrale catalogus: wat je hier wijzigt, geldt direct voor de menukaart én het online bestellen. Bestaande bestellingen houden hun oorspronkelijke prijs.' })),
      ...blocks);
  }

  function productRow(p, data) {
    const sold = el('input', { type: 'checkbox', checked: p.sold_out });
    sold.onchange = () => guarded(() => api(`/api/admin/products/${p.id}/sold-out`, { method: 'POST', body: { sold_out: sold.checked } }),
      sold.checked ? `${p.name.nl} is uitverkocht.` : `${p.name.nl} is weer beschikbaar.`).then((r) => { if (!r) sold.checked = !sold.checked; });
    return el('div', { class: 'prod-row' + (p.active ? '' : ' inactive') },
      p.image ? el('img', { class: 'thumb', src: p.image, alt: '' }) : null,
      el('span', { class: 'name' }, p.name.nl, p.orderable ? '' : el('span', { class: 'muted small', text: ' (alleen menukaart)' })),
      el('span', { text: money(p.price_cents) }),
      el('label', { class: 'switch' }, sold, 'Uitverkocht'),
      el('button', { type: 'button', class: 'btn btn-small', onclick: () => editProduct(p, p.category_id, data) }, 'Wijzigen'));
  }

  function editCategory(c) {
    let image = c?.image || '';
    const imgBox = el('div', {});
    const renderImg = () => put(imgBox,
      image ? el('img', { class: 'thumb', src: image, alt: '' }) : el('span', { class: 'muted small', text: 'Geen foto' }), ' ',
      el('button', { type: 'button', class: 'btn btn-small', onclick: async () => { const u = await pickImage(); if (u) { image = u; renderImg(); } } }, image ? 'Vervangen' : 'Foto toevoegen'),
      image ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { image = ''; renderImg(); } }, 'Weghalen') : null);
    renderImg();
    const f = el('form', {},
      el('div', { class: 'grid2' },
        field('Naam (NL)', input('name_nl', c?.name.nl, { required: true, maxlength: 80 })),
        field('Naam (EN)', input('name_en', c?.name.en, { maxlength: 80 })),
        field('Toelichting (NL)', input('desc_nl', c?.description.nl, { maxlength: 300 }), 'Bijv. "Tot 11:30 uur"'),
        field('Toelichting (EN)', input('desc_en', c?.description.en, { maxlength: 300 })),
        field('Volgorde', input('sort', c?.sort ?? 0, { type: 'number' }))),
      el('div', { class: 'field' }, el('label', { text: 'Foto bovenaan deze categorie op de menukaart (optioneel, eigen foto)' }), imgBox),
      check('active', c ? c.active : true, 'Zichtbaar op de website'));
    const save = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
      const v = Object.fromEntries(new FormData(f));
      v.image = image;
      v.active = f.active.checked;
      v.sort = Number(v.sort) || 0;
      const r = await guarded(() => api(c ? `/api/admin/categories/${c.id}` : '/api/admin/categories', { method: c ? 'PUT' : 'POST', body: v }), 'Categorie opgeslagen.');
      if (r) { closeDialog(); viewMenu(); }
    } }, 'Opslaan');
    const actions = [save, el('button', { type: 'button', class: 'btn', onclick: closeDialog }, 'Annuleren')];
    if (c) actions.push(el('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
      if (!confirm(`Categorie "${c.name.nl}" verwijderen?`)) return;
      if (await guarded(() => api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }), 'Categorie verwijderd.')) { closeDialog(); viewMenu(); }
    } }, 'Verwijderen'));
    dialog(c ? 'Categorie wijzigen' : 'Nieuwe categorie', f, actions);
  }

  function editProduct(p, categoryId, data) {
    let image = p?.image || '';
    let groups = structuredClone(p?.option_groups || []);
    const imgPrev = el('div', {});
    const renderImg = () => put(imgPrev, 
      image ? el('img', { class: 'thumb', src: image, alt: '' }) : el('span', { class: 'muted small', text: 'Geen afbeelding' }), ' ',
      el('button', { type: 'button', class: 'btn btn-small', onclick: async () => { const u = await pickImage(); if (u) { image = u; renderImg(); } } }, image ? 'Vervangen' : 'Afbeelding toevoegen'),
      image ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { image = ''; renderImg(); } }, 'Weghalen') : null);
    renderImg();

    const catSel = el('select', { name: 'category_id' }, data.categories.map((c) => el('option', { value: c.id, text: c.name.nl })));
    catSel.value = String(categoryId);
    const groupsBox = el('div', {});
    const renderGroups = () => put(groupsBox, ...groups.map((g, gi) => {
      const opts = g.options.map((o, oi) => el('div', { class: 'opt-row' },
        input('', o.name.nl, { placeholder: 'Optie (NL)', 'aria-label': 'Optie NL', oninput: (e) => { o.name.nl = e.target.value; } }),
        input('', o.name.en, { placeholder: 'Option (EN)', 'aria-label': 'Optie EN', oninput: (e) => { o.name.en = e.target.value; } }),
        input('', euroInput(o.price_cents), { inputmode: 'decimal', 'aria-label': 'Meerprijs', title: 'Meerprijs in euro', oninput: (e) => { o.price_cents = parseEuro(e.target.value); } }),
        el('div', { class: 'pill-row' },
          el('label', { class: 'switch small' }, el('input', { type: 'checkbox', checked: o.is_default, onchange: (e) => { o.is_default = e.target.checked; } }), 'standaard'),
          el('label', { class: 'switch small' }, el('input', { type: 'checkbox', checked: o.sold_out, onchange: (e) => { o.sold_out = e.target.checked; } }), 'uitverkocht'),
          el('button', { type: 'button', class: 'btn btn-small btn-ghost', 'aria-label': 'Optie verwijderen', onclick: () => { g.options.splice(oi, 1); renderGroups(); } }, '×'))));
      const kind = el('select', { onchange: (e) => { g.kind = e.target.value; renderGroups(); } },
        el('option', { value: 'single', text: 'Eén keuze (bijv. soort brood)' }), el('option', { value: 'multi', text: 'Meerdere keuzes (bijv. extra beleg)' }));
      kind.value = g.kind;
      return el('div', { class: 'group-editor' },
        el('div', { class: 'grid2' },
          field('Naam keuzegroep (NL)', input('', g.name.nl, { oninput: (e) => { g.name.nl = e.target.value; } })),
          field('Naam keuzegroep (EN)', input('', g.name.en, { oninput: (e) => { g.name.en = e.target.value; } })),
          field('Soort', kind),
          g.kind === 'multi' ? field('Maximaal aantal (0 = geen maximum)', input('', g.max_select || 0, { type: 'number', min: 0, oninput: (e) => { g.max_select = Number(e.target.value) || 0; } })) : el('span')),
        el('label', { class: 'switch' }, el('input', { type: 'checkbox', checked: g.required, onchange: (e) => { g.required = e.target.checked; } }), 'Verplicht een keuze maken'),
        el('p', { class: 'small muted', text: 'Opties: naam NL · naam EN · meerprijs (€)' }),
        opts,
        el('div', { class: 'pill-row' },
          el('button', { type: 'button', class: 'btn btn-small', onclick: () => { g.options.push({ name: { nl: '', en: '' }, price_cents: 0, is_default: false, sold_out: false }); renderGroups(); } }, '+ Optie'),
          el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { groups.splice(gi, 1); renderGroups(); } }, 'Keuzegroep verwijderen')));
    }), el('button', { type: 'button', class: 'btn btn-small', onclick: () => {
      groups.push({ name: { nl: '', en: '' }, kind: 'single', required: false, max_select: 0, options: [{ name: { nl: '', en: '' }, price_cents: 0, is_default: false, sold_out: false }] });
      renderGroups();
    } }, '+ Keuzegroep (variant of extra)'));
    renderGroups();

    const f = el('form', {},
      el('div', { class: 'grid2' },
        field('Naam (NL)', input('name_nl', p?.name.nl, { required: true, maxlength: 120 })),
        field('Naam (EN)', input('name_en', p?.name.en, { maxlength: 120 })),
        field('Omschrijving (NL)', textarea('desc_nl', p?.description.nl, { maxlength: 500 })),
        field('Omschrijving (EN)', textarea('desc_en', p?.description.en, { maxlength: 500 })),
        field('Prijs (€, incl. btw)', input('price', euroInput(p?.price_cents ?? 0), { inputmode: 'decimal', required: true })),
        field('Categorie', catSel),
        field('Volgorde', input('sort', p?.sort ?? 0, { type: 'number' }))),
      el('div', { class: 'field' }, el('label', { text: 'Afbeelding (optioneel, eigen foto: JPG, PNG of WebP, max. 5 MB)' }), imgPrev),
      el('div', { class: 'pill-row' },
        check('active', p ? p.active : true, 'Zichtbaar op de website'),
        check('orderable', p ? p.orderable : true, 'Online te bestellen'),
        check('sold_out', p ? p.sold_out : false, 'Tijdelijk uitverkocht')),
      el('h3', { text: 'Allergenen' }),
      el('p', { class: 'small muted', text: 'Vink alleen aan wat je zeker weet. De website toont precies wat hier staat, met de opmerking dat gasten bij twijfel moeten vragen. Niets aanvinken betekent niet "vrij van": dan toont de site dat er geen informatie is ingevuld, tenzij je een toelichting geeft.' }),
      el('div', { class: 'check-grid' }, data.allergens.map((a) => check('allergen', p?.allergens.includes(a), AL[a] || a))),
      el('div', { class: 'grid2' },
        field('Toelichting allergenen (NL)', input('allergen_note_nl', p?.allergen_note.nl, { maxlength: 300 })),
        field('Toelichting allergenen (EN)', input('allergen_note_en', p?.allergen_note.en, { maxlength: 300 }))),
      el('h3', { text: 'Dieet' }),
      el('div', { class: 'check-grid' }, data.diets.map((d) => check('diet', p?.diets.includes(d), DI[d] || d))),
      el('h3', { text: 'Varianten en extra’s' }),
      groupsBox);
    f.querySelectorAll('input[name=allergen]').forEach((i, idx) => { i.value = data.allergens[idx]; });
    f.querySelectorAll('input[name=diet]').forEach((i, idx) => { i.value = data.diets[idx]; });

    const save = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
      const price = parseEuro(f.price.value);
      if (Number.isNaN(price)) return flash('Vul een geldige prijs in, bijv. 6,25', 'alert');
      if (groups.some((g) => g.options.some((o) => Number.isNaN(o.price_cents)))) return flash('Vul geldige meerprijzen in, bijv. 0,50', 'alert');
      const body = {
        category_id: Number(catSel.value),
        name_nl: f.name_nl.value, name_en: f.name_en.value, desc_nl: f.desc_nl.value, desc_en: f.desc_en.value,
        price_cents: price, sort: Number(f.sort.value) || 0, image,
        active: f.active.checked, orderable: f.orderable.checked, sold_out: f.sold_out.checked,
        allergens: [...f.querySelectorAll('input[name=allergen]:checked')].map((i) => i.value),
        diets: [...f.querySelectorAll('input[name=diet]:checked')].map((i) => i.value),
        allergen_note_nl: f.allergen_note_nl.value, allergen_note_en: f.allergen_note_en.value,
        option_groups: groups.map((g) => ({
          id: g.id, name_nl: g.name.nl, name_en: g.name.en, kind: g.kind, required: g.required, max_select: g.max_select,
          options: g.options.map((o) => ({ id: o.id, name_nl: o.name.nl, name_en: o.name.en, price_cents: o.price_cents, is_default: o.is_default, sold_out: o.sold_out })),
        })),
      };
      const r = await guarded(() => api(p ? `/api/admin/products/${p.id}` : '/api/admin/products', { method: p ? 'PUT' : 'POST', body }), 'Gerecht opgeslagen.');
      if (r) { closeDialog(); viewMenu(); }
    } }, 'Opslaan');
    const actions = [save, el('button', { type: 'button', class: 'btn', onclick: closeDialog }, 'Annuleren')];
    if (p) actions.push(el('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
      if (!confirm(`"${p.name.nl}" verwijderen? Tip: je kunt een gerecht ook verbergen of als uitverkocht markeren.`)) return;
      if (await guarded(() => api(`/api/admin/products/${p.id}`, { method: 'DELETE' }), 'Gerecht verwijderd.')) { closeDialog(); viewMenu(); }
    } }, 'Verwijderen'));
    dialog(p ? `${p.name.nl} wijzigen` : 'Nieuw gerecht', f, actions);
  }

  // ---------- tijden ----------
  function hoursEditor(hours) {
    const rows = DAY_KEYS.map((k, i) => {
      const r = (hours[k] || [])[0];
      const open = el('input', { type: 'checkbox', checked: !!r });
      const from = el('input', { type: 'time', value: r?.from || '09:00', 'aria-label': `${DAYS[i]} van` });
      const to = el('input', { type: 'time', value: r?.to || '17:00', 'aria-label': `${DAYS[i]} tot` });
      const sync = () => { from.disabled = to.disabled = !open.checked; };
      open.onchange = sync; sync();
      return { k, row: el('div', { class: 'day-row' }, el('strong', { text: DAYS[i] }), el('label', { class: 'switch' }, open, 'open'), from, to), open, from, to };
    });
    return {
      node: el('div', {}, rows.map((r) => r.row)),
      value: () => Object.fromEntries(rows.map((r) => [r.k, r.open.checked ? [{ from: r.from.value, to: r.to.value }] : []])),
    };
  }

  async function viewHours() {
    const s = await api('/api/admin/settings');
    const closures = (await api('/api/admin/closures')).closures;
    const opening = hoursEditor(s.opening_hours);
    const pickupH = hoursEditor(s.pickup.hours);
    const p = s.pickup;
    const pf = el('form', { class: 'grid2' },
      field('Tijdvak (minuten)', input('interval_min', p.interval_min, { type: 'number', min: 5, max: 120 }), 'Bijv. 15: klanten kiezen 12:00, 12:15, 12:30 …'),
      field('Voorbereidingstijd (minuten)', input('prep_min', p.prep_min, { type: 'number', min: 0 }), 'Vroegst mogelijke afhaaltijd = nu + deze tijd.'),
      field('Maximum bestellingen per tijdvak', input('max_per_slot', p.max_per_slot, { type: 'number', min: 1 })),
      field('Hoeveel dagen vooruit bestellen', input('days_ahead', p.days_ahead, { type: 'number', min: 0, max: 60 }), '0 = alleen vandaag.'));

    const saveAll = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
      const ok1 = await guarded(() => api('/api/admin/settings/opening_hours', { method: 'PUT', body: opening.value() }));
      if (!ok1) return;
      const ok2 = await guarded(() => api('/api/admin/settings/pickup', { method: 'PUT', body: {
        hours: pickupH.value(), interval_min: Number(pf.interval_min.value), prep_min: Number(pf.prep_min.value),
        max_per_slot: Number(pf.max_per_slot.value), days_ahead: Number(pf.days_ahead.value),
      } }), 'Tijden opgeslagen.');
      if (ok2) viewHours();
    } }, 'Tijden opslaan');

    const cFrom = el('input', { type: 'date', 'aria-label': 'Vanaf' });
    const cTo = el('input', { type: 'date', 'aria-label': 'Tot en met' });
    const cNl = input('', '', { placeholder: 'Reden (NL), bijv. Kerst' });
    const cEn = input('', '', { placeholder: 'Reason (EN), e.g. Christmas' });
    put($('view'), 
      el('div', { class: 'panel' }, el('h2', { text: 'Openingstijden' }), el('p', { class: 'small muted', text: 'Zoals getoond op de website.' }), opening.node),
      el('div', { class: 'panel' }, el('h2', { text: 'Afhaalmomenten' }), el('p', { class: 'small muted', text: 'Tussen welke tijden klanten online bestellingen kunnen ophalen.' }), pickupH.node, pf),
      el('div', { class: 'form-actions' }, saveAll),
      el('div', { class: 'panel' }, el('h2', { text: 'Sluitingsdagen' }),
        el('p', { class: 'small muted', text: 'Op deze dagen kan er niet worden afgehaald; ze staan ook op de website.' }),
        closures.length ? el('ul', {}, closures.map((c) => el('li', {}, `${c.date_from}${c.date_to !== c.date_from ? ' t/m ' + c.date_to : ''} ${c.reason_nl ? '– ' + c.reason_nl : ''} `,
          el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: async () => { if (await guarded(() => api('/api/admin/closures/' + c.id, { method: 'DELETE' }), 'Verwijderd.')) viewHours(); } }, 'Verwijderen')))) : el('p', { class: 'muted', text: 'Geen sluitingsdagen.' }),
        el('div', { class: 'grid2' }, field('Vanaf', cFrom), field('Tot en met (leeg = één dag)', cTo), field('Reden (NL)', cNl), field('Reden (EN)', cEn)),
        el('button', { type: 'button', class: 'btn', onclick: async () => {
          if (await guarded(() => api('/api/admin/closures', { method: 'POST', body: { date_from: cFrom.value, date_to: cTo.value || cFrom.value, reason_nl: cNl.value, reason_en: cEn.value } }), 'Sluitingsdag toegevoegd.')) viewHours();
        } }, '+ Sluitingsdag toevoegen')));
  }

  // ---------- bestellen & betalen ----------
  async function viewOrdering() {
    const s = (await api('/api/admin/settings')).ordering;
    const sys = await api('/api/admin/system');
    const providerOk = sys.payment_provider !== 'none';
    const f = el('form', {},
      el('div', { class: 'panel' },
        el('h2', { text: 'Online bestellen' }),
        check('paused', s.paused, 'Online bestellen tijdelijk pauzeren'),
        el('div', { class: 'grid2' },
          field('Melding bij pauze (NL)', input('pause_message_nl', s.pause_message_nl)),
          field('Melding bij pauze (EN)', input('pause_message_en', s.pause_message_en))),
        el('div', { class: 'pill-row' },
          check('pickup_enabled', s.pickup_enabled, 'Afhalen aanbieden'),
          check('delivery_enabled', s.delivery_enabled, 'Bezorgen aanbieden')),
        el('p', { class: 'small muted', text: 'Bezorggebieden, bezorgkosten, minimum bestelbedrag en bezorgtijden stel je in bij het tabblad Bezorgen. Bezorgen is pas zichtbaar voor klanten als er minstens één actief bezorggebied is.' })),
      el('div', { class: 'panel' },
        el('h2', { text: 'Betaalmogelijkheden' }),
        check('pay_online', s.pay_online, 'Online betalen via de betaalprovider'),
        providerOk ? el('p', { class: 'small muted', text: `Betaalprovider: ${sys.payment_provider}${sys.payment_test_mode ? ' (testmodus – er wordt geen echt geld afgeschreven)' : ' (live)'}` })
          : el('p', { class: 'notice', text: 'Er is nog geen betaalprovider gekoppeld. Online betalen is pas zichtbaar voor klanten als de beheerder van de server een sleutel heeft ingesteld (zie installatiehandleiding).' }),
        el('br'),
        check('pay_at_pickup', s.pay_at_pickup, 'Betalen bij afhalen toestaan'),
        el('br'),
        check('pay_on_delivery', s.pay_on_delivery, 'Betalen bij bezorging toestaan (contant of pin aan de deur)')),
      el('div', { class: 'panel' },
        el('h2', { text: 'Kosten en overige' }),
        el('div', { class: 'grid2' },
          field('Servicekosten per bestelling (€)', input('fee', euroInput(s.fee_cents), { inputmode: 'decimal' }), 'Wordt vóór het afrekenen getoond. 0 = geen kosten. Controleer zelf of extra kosten voor jouw situatie zijn toegestaan.'),
          field('Naam van de kosten (NL)', input('fee_label_nl', s.fee_label_nl)),
          field('Naam van de kosten (EN)', input('fee_label_en', s.fee_label_en)),
          field('Voorvoegsel bestelnummer', input('order_prefix', s.order_prefix, { maxlength: 6 })),
          field('Reserveringstijd online betaling (minuten)', input('hold_minutes', s.hold_minutes, { type: 'number', min: 10, max: 120 }), 'Zo lang blijft een tijdvak gereserveerd terwijl de klant betaalt.'),
          field('Maximum aantal gerechten per bestelling', input('max_items', s.max_items, { type: 'number', min: 1, max: 200 })))));
    const save = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
      const fee = parseEuro(f.fee.value);
      if (Number.isNaN(fee)) return flash('Ongeldige servicekosten.', 'alert');
      if (!f.pickup_enabled.checked && !f.delivery_enabled.checked) return flash('Zet afhalen of bezorgen aan (of pauzeer het bestellen).', 'alert');
      if (f.pickup_enabled.checked && !f.pay_online.checked && !f.pay_at_pickup.checked) return flash('Voor afhalen is minimaal één betaalmogelijkheid nodig.', 'alert');
      if (f.delivery_enabled.checked && !f.pay_online.checked && !f.pay_on_delivery.checked) return flash('Voor bezorgen is minimaal één betaalmogelijkheid nodig.', 'alert');
      const body = {
        paused: f.paused.checked, pause_message_nl: f.pause_message_nl.value, pause_message_en: f.pause_message_en.value,
        pickup_enabled: f.pickup_enabled.checked, delivery_enabled: f.delivery_enabled.checked,
        pay_online: f.pay_online.checked, pay_at_pickup: f.pay_at_pickup.checked, pay_on_delivery: f.pay_on_delivery.checked, fee_cents: fee,
        fee_label_nl: f.fee_label_nl.value, fee_label_en: f.fee_label_en.value, order_prefix: f.order_prefix.value,
        hold_minutes: Number(f.hold_minutes.value), max_items: Number(f.max_items.value),
      };
      if (await guarded(() => api('/api/admin/settings/ordering', { method: 'PUT', body }), 'Instellingen opgeslagen.')) updatePauseIndicator();
    } }, 'Opslaan');
    put($('view'), f, el('div', { class: 'form-actions' }, save));
  }

  // ---------- bedrijf & website ----------
  async function viewBusiness() {
    const s = await api('/api/admin/settings');
    const b = s.business;
    const c = s.content;
    let hero = c.hero_image;
    let gallery = structuredClone(c.gallery || []);
    const heroBox = el('div', {});
    const renderHero = () => put(heroBox, 
      hero ? el('img', { class: 'thumb', src: hero, alt: '' }) : el('span', { class: 'muted', text: 'Geen sfeerbeeld' }), ' ',
      el('button', { type: 'button', class: 'btn btn-small', onclick: async () => { const u = await pickImage(); if (u) { hero = u; renderHero(); } } }, 'Eigen sfeerbeeld uploaden'));
    renderHero();
    const galBox = el('div', {});
    const renderGal = () => put(galBox, el('div', { class: 'gallery-edit' }, gallery.map((g, i) => el('div', { class: 'item card' },
      el('img', { class: 'thumb', src: g.src, alt: '' }),
      input('', g.alt_nl, { placeholder: 'Beschrijving (NL)', 'aria-label': 'Beschrijving NL', oninput: (e) => { g.alt_nl = e.target.value; } }),
      input('', g.alt_en, { placeholder: 'Description (EN)', 'aria-label': 'Beschrijving EN', oninput: (e) => { g.alt_en = e.target.value; } }),
      el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { gallery.splice(i, 1); renderGal(); } }, 'Weghalen')))),
    el('button', { type: 'button', class: 'btn btn-small', onclick: async () => { const u = await pickImage(); if (u) { gallery.push({ src: u, alt_nl: '', alt_en: '' }); renderGal(); } } }, '+ Foto toevoegen'));
    renderGal();

    const bf = el('form', { class: 'panel' },
      el('h2', { text: 'Bedrijfsgegevens' }),
      el('div', { class: 'grid2' },
        field('Naam zaak', input('name', b.name, { required: true })),
        field('Ondertitel (NL)', input('tagline_nl', b.tagline_nl), 'Bijv. koffie & lunch'),
        field('Ondertitel (EN)', input('tagline_en', b.tagline_en)),
        field('Straat en huisnummer', input('street', b.street)),
        field('Postcode', input('postal_code', b.postal_code)),
        field('Plaats', input('city', b.city)),
        field('Telefoon', input('phone', b.phone)),
        field('E-mail (op de website)', input('email', b.email, { type: 'email' })),
        field('E-mail voor meldingen van nieuwe bestellingen', input('notify_email', b.notify_email, { type: 'email' }), 'Wordt niet getoond op de website.'),
        field('KvK-nummer (optioneel)', input('kvk', b.kvk)),
        field('Link naar kaart / route (https://…)', input('maps_url', b.maps_url), 'Bijv. een Google Maps- of OpenStreetMap-link. Leeg = automatisch op adres.'),
        el('span'),
        field('Routebeschrijving (NL)', textarea('route_nl', b.route_nl)),
        field('Routebeschrijving (EN)', textarea('route_en', b.route_en))),
      check('is_fictional', b.is_fictional, 'Dit zijn fictieve gegevens (toont een melding op de website)'));
    const cf = el('form', { class: 'panel' },
      el('h2', { text: 'Website-inhoud' }),
      el('div', { class: 'field' }, el('label', { text: 'Sfeerbeeld eerste scherm' }), heroBox),
      el('div', { class: 'grid2' },
        field('Kop (NL)', input('hero_title_nl', c.hero_title_nl)),
        field('Kop (EN)', input('hero_title_en', c.hero_title_en)),
        field('Introductie (NL)', textarea('intro_nl', c.intro_nl)),
        field('Introductie (EN)', textarea('intro_en', c.intro_en)),
        field('Titel verhaal (NL)', input('story_title_nl', c.story_title_nl)),
        field('Titel verhaal (EN)', input('story_title_en', c.story_title_en)),
        field('Verhaal (NL)', textarea('story_nl', c.story_nl, { rows: 6 }), 'Lege regel = nieuwe alinea.'),
        field('Verhaal (EN)', textarea('story_en', c.story_en, { rows: 6 }))),
      el('h3', { text: 'Sfeerbeelden' }),
      el('p', { class: 'small muted', text: 'Gebruik alleen foto’s waarvan je de rechten hebt. JPG, PNG of WebP, maximaal 5 MB.' }),
      galBox);
    const save = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
      const bv = Object.fromEntries(new FormData(bf));
      bv.is_fictional = bf.is_fictional.checked;
      const ok = await guarded(() => api('/api/admin/settings/business', { method: 'PUT', body: bv }));
      if (!ok) return;
      const cv = Object.fromEntries(new FormData(cf));
      cv.hero_image = hero;
      cv.gallery = gallery;
      await guarded(() => api('/api/admin/settings/content', { method: 'PUT', body: cv }), 'Bedrijfsgegevens en website opgeslagen.');
    } }, 'Opslaan');
    put($('view'), bf, cf, el('div', { class: 'form-actions' }, save));
  }

  // ---------- systeem ----------
  async function viewSystem() {
    const sys = await api('/api/admin/system');
    const mails = (await api('/api/admin/outbox')).mails;
    const row = (k, v) => el('tr', {}, el('th', { text: k }), el('td', { text: String(v) }));
    put($('view'), 
      el('div', { class: 'panel' }, el('h2', { text: 'Systeemstatus' }),
        el('div', { class: 'table-scroll' }, el('table', { class: 'admin-table' }, el('tbody', {},
          row('Omgeving', sys.demo ? 'DEMO (fictief, testbetalingen)' : 'Live klantomgeving'),
          row('Adres', sys.base_url),
          row('Betaalprovider', sys.payment_provider === 'none' ? 'niet ingesteld' : `${sys.payment_provider}${sys.payment_test_mode ? ' (testmodus)' : ' (live)'}`),
          row('Webhook-adres', sys.webhook_url),
          row('E-mail', sys.mail_enabled ? `${sys.mail_provider} (actief)` : `${sys.mail_provider} – e-mails worden niet verzonden`),
          row('Tijdzone', sys.timezone),
          row('Actieve bestellingen vandaag', sys.open_orders_today))))),
      el('div', { class: 'panel' }, el('h2', { text: 'Verstuurde e-mails' }),
        el('p', { class: 'small muted', text: 'Mislukt een e-mail, dan staat de bestelling gewoon onder Bestellingen. Je kunt een mislukte mail opnieuw versturen.' }),
        mails.length ? el('div', { class: 'table-scroll' }, el('table', { class: 'admin-table' },
          el('thead', {}, el('tr', {}, ...['Datum', 'Bestelling', 'Aan', 'Status', ''].map((h) => el('th', { text: h })))),
          el('tbody', {}, mails.map((m) => el('tr', {},
            el('td', { text: dt(m.created_at) }), el('td', { text: m.number || '' }), el('td', { text: m.to_addr }),
            el('td', { text: mailStatus(m.status) + (m.error ? ` – ${m.error}` : '') }),
            el('td', {}, m.status === 'failed' ? el('button', { type: 'button', class: 'btn btn-small', onclick: async () => { await guarded(() => api(`/api/admin/outbox/${m.id}/retry`, { method: 'POST', body: {} }), 'Opnieuw geprobeerd.'); viewSystem(); } }, 'Opnieuw') : null)))))) : el('p', { class: 'muted', text: 'Nog geen e-mails.' })));
  }

  // ---------- account ----------
  async function viewAccount() {
    const cur = el('input', { type: 'password', autocomplete: 'current-password' });
    const next = el('input', { type: 'password', autocomplete: 'new-password', minlength: 12 });
    put($('view'), 
      el('div', { class: 'panel' }, el('h2', { text: 'Account' }), el('p', {}, `Ingelogd als ${me.admin.email}`),
        el('button', { type: 'button', class: 'btn', onclick: async () => { await api('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {}); csrf = null; showLogin(); } }, 'Uitloggen')),
      el('div', { class: 'panel' }, el('h2', { text: 'Wachtwoord wijzigen' }),
        field('Huidig wachtwoord', cur), field('Nieuw wachtwoord (min. 12 tekens)', next),
        el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
          if (await guarded(() => api('/api/admin/password', { method: 'POST', body: { current: cur.value, next: next.value } }), 'Wachtwoord gewijzigd. Log opnieuw in.')) showLogin();
        } }, 'Wijzigen')));
  }

  // ---------- bezorgen ----------
  async function viewDelivery() {
    const all = await api('/api/admin/settings');
    const d = all.delivery;
    let zones = structuredClone(d.zones || []);
    const hours = hoursEditor(d.hours);
    const pf = el('form', { class: 'grid2' },
      field('Tijdvak (minuten)', input('interval_min', d.interval_min, { type: 'number', min: 5, max: 120 }), 'Bijv. 30: klanten kiezen 12:00, 12:30, 13:00 …'),
      field('Voorbereiding + rijtijd (minuten)', input('prep_min', d.prep_min, { type: 'number', min: 0 }), 'Vroegst mogelijke bezorgtijd = nu + deze tijd.'),
      field('Maximum bezorgingen per tijdvak', input('max_per_slot', d.max_per_slot, { type: 'number', min: 1 }), 'Hoeveel adressen je bezorger(s) per tijdvak aankunnen.'),
      field('Hoeveel dagen vooruit', input('days_ahead', d.days_ahead, { type: 'number', min: 0, max: 60 })));

    const zonesBox = el('div', {});
    const renderZones = () => put(zonesBox,
      zones.length ? null : el('p', { class: 'muted', text: 'Nog geen bezorggebieden. Zonder actief gebied is bezorgen niet zichtbaar voor klanten.' }),
      ...zones.map((z, i) => el('div', { class: 'group-editor' },
        el('div', { class: 'grid2' },
          field('Naam gebied (NL)', input('', z.name_nl, { oninput: (e) => { z.name_nl = e.target.value; } })),
          field('Naam gebied (EN)', input('', z.name_en, { oninput: (e) => { z.name_en = e.target.value; } })),
          field('Postcodes (4 cijfers, los of als reeks)', input('', z.postcodes, { placeholder: '1011-1018, 1020', oninput: (e) => { z.postcodes = e.target.value; } }),
            'Bijvoorbeeld 1011-1018, 1020. Klanten met een postcode in deze reeks vallen in dit gebied.'),
          el('span'),
          field('Bezorgkosten (€)', input('', euroInput(z.fee_cents), { inputmode: 'decimal', oninput: (e) => { z.fee_cents = parseEuro(e.target.value); } })),
          field('Minimum bestelbedrag (€)', input('', euroInput(z.min_order_cents), { inputmode: 'decimal', oninput: (e) => { z.min_order_cents = parseEuro(e.target.value); } }),
            'Over de gerechten, zonder bezorg- of servicekosten.')),
        el('div', { class: 'pill-row' },
          el('label', { class: 'switch' }, el('input', { type: 'checkbox', checked: z.active !== false, onchange: (e) => { z.active = e.target.checked; } }), 'Actief'),
          el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { zones.splice(i, 1); renderZones(); } }, 'Gebied verwijderen')))),
      el('button', { type: 'button', class: 'btn btn-small', onclick: () => {
        zones.push({ name_nl: '', name_en: '', postcodes: '', fee_cents: 0, min_order_cents: 0, active: true });
        renderZones();
      } }, '+ Bezorggebied'));
    renderZones();

    const save = el('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
      if (zones.some((z) => Number.isNaN(z.fee_cents) || Number.isNaN(z.min_order_cents))) return flash('Vul geldige bedragen in, bijv. 2,50', 'alert');
      const body = {
        hours: hours.value(), interval_min: Number(pf.interval_min.value), prep_min: Number(pf.prep_min.value),
        max_per_slot: Number(pf.max_per_slot.value), days_ahead: Number(pf.days_ahead.value), zones,
      };
      const r = await guarded(() => api('/api/admin/settings/delivery', { method: 'PUT', body }), 'Bezorginstellingen opgeslagen.');
      if (r) { zones = structuredClone(r.zones); renderZones(); }
    } }, 'Bezorginstellingen opslaan');

    put($('view'),
      all.ordering.delivery_enabled ? null : el('p', { class: 'notice', text: 'Bezorgen staat nu uit. Zet het aan bij Bestellen & betalen zodra je gebieden en tijden klaar zijn.' }),
      el('div', { class: 'panel' }, el('h2', { text: 'Bezorggebieden' }),
        el('p', { class: 'small muted', text: 'Per gebied eigen bezorgkosten en een minimum bestelbedrag. De klant ziet direct na het invullen van de postcode of er bezorgd wordt en wat het kost; de server controleert dit bij elke bestelling opnieuw.' }),
        zonesBox),
      el('div', { class: 'panel' }, el('h2', { text: 'Bezorgtijden' }),
        el('p', { class: 'small muted', text: 'Los van de afhaaltijden. Sluitingsdagen (tabblad Tijden & afhalen) gelden ook voor bezorgen.' }),
        hours.node, pf),
      el('div', { class: 'form-actions' }, save));
  }

  const VIEWS = { orders: viewOrders, menu: viewMenu, hours: viewHours, delivery: viewDelivery, ordering: viewOrdering, business: viewBusiness, system: viewSystem, account: viewAccount };
  start();
})();
