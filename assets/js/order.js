/* Bestelomgeving: gerechten kiezen, winkelwagen, afhaalmoment, gegevens, afrekenen.
   De winkelwagen staat in de browser als gemak; prijzen, beschikbaarheid en
   tijdvakken worden altijd door de server gecontroleerd. */
(function () {
  'use strict';
  const { el, t, pick, put } = AT;
  const $ = (id) => document.getElementById(id);
  const CART_KEY = 'at_cart_v1';

  let site = null;
  let products = new Map();
  let categories = [];
  let cart = loadCart();
  let quote = null;
  let lineErrors = new Map();
  let dates = [];
  let sel = { date: null, time: null };
  let view = 'menu';
  let submitting = false;
  let mode = null; // 'pickup' of 'delivery'
  let zoneCheck = null; // antwoord van /api/delivery/check voor de ingevulde postcode

  const addressInput = () => ({
    street: $('street').value.trim(), houseNumber: $('houseNumber').value.trim(),
    postcode: $('postcode').value.trim(), city: $('city').value.trim(),
  });
  const validPostcode = (s) => /^\s*[1-9]\d{3}\s?[a-zA-Z]{2}\s*$/.test(s);

  // ---------- opslag ----------
  function loadCart() {
    try { const v = JSON.parse(AT.read(CART_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function saveCart() { AT.store(CART_KEY, JSON.stringify(cart)); }
  const lineKey = (l) => `${l.productId}|${[...l.options].sort((a, b) => a - b).join(',')}|${l.note}`;
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    return [...b].map((x) => x.toString(16).padStart(2, '0')).join('').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }

  // ---------- berekening in de browser (alleen ter weergave) ----------
  function unitPrice(p, optionIds) {
    let sum = p.price_cents;
    for (const g of p.option_groups) for (const o of g.options) if (optionIds.includes(o.id)) sum += o.price_cents;
    return sum;
  }
  function optionNames(p, optionIds) {
    const out = [];
    for (const g of p.option_groups) for (const o of g.options) if (optionIds.includes(o.id)) out.push(pick(o.name));
    return out;
  }

  // ---------- menu ----------
  function renderMenu() {
    const cats = categories.filter((c) => c.products.some((p) => p.orderable));
    put($('chips'), ...cats.map((c) => el('a', { class: 'chip', href: `#c-${c.id}`, text: pick(c.name) })));
    put($('menu'), ...cats.map((c) => el('div', { class: 'menu-cat order-cat', id: `c-${c.id}` },
      c.image ? el('img', { class: 'order-cat-img', src: c.image, alt: '', loading: 'lazy' }) : null,
      el('div', { class: 'order-cat-head' }, el('h3', { text: pick(c.name) }),
        pick(c.description) ? el('span', { class: 'muted', text: pick(c.description) }) : null),
      el('ul', { class: 'menu-list' }, c.products.filter((p) => p.orderable).map(dishCard)))));
  }

  function dishCard(p) {
    const disabled = p.sold_out || site.ordering.paused;
    return el('li', { class: 'dish' + (p.sold_out ? ' is-out' : '') },
      p.image ? el('img', { class: 'dish-img', src: p.image, alt: '', loading: 'lazy' }) : null,
      el('div', { class: 'dish-body' },
        el('div', { class: 'dish-top' }, el('h4', { text: pick(p.name) }), el('span', { class: 'price', text: AT.money(p.price_cents) })),
        pick(p.description) ? el('p', { text: pick(p.description) }) : null,
        el('div', { class: 'tags' }, AT.dietTags(p), p.sold_out ? el('span', { class: 'tag tag-out', text: t('sold_out') }) : null),
        el('p', { class: 'allergen-line', text: AT.allergenText(p) }),
        el('div', { class: 'dish-actions' },
          el('button', {
            type: 'button', class: 'btn btn-small', disabled,
            'aria-label': `${t('add')}: ${pick(p.name)}`,
            onclick: () => openDish(p),
          }, p.sold_out ? t('sold_out') : `+ ${t('add')}`))));
  }

  // ---------- gerecht-dialoog ----------
  let dlg = { product: null, qty: 1, editIndex: null };

  function openDish(p, editIndex = null) {
    const existing = editIndex != null ? cart[editIndex] : null;
    dlg = { product: p, qty: existing ? existing.quantity : 1, editIndex };
    $('dish-title').textContent = pick(p.name);
    const chosen = existing ? existing.options : p.option_groups.flatMap((g) => g.options.filter((o) => o.is_default && !o.sold_out).map((o) => o.id));
    const body = [];
    if (pick(p.description)) body.push(el('p', { class: 'muted', text: pick(p.description) }));
    body.push(el('div', { class: 'tags' }, AT.dietTags(p)));
    body.push(el('p', { class: 'allergen-line', text: AT.allergenText(p) }));
    for (const g of p.option_groups) {
      const hint = g.kind === 'single' ? t('choose_one') : g.max_select ? t('choose_max', g.max_select) : '';
      const fs = el('fieldset', { class: 'field', 'data-group': g.id },
        el('legend', {}, pick(g.name), ' ', el('span', { class: 'muted small', text: `(${g.required ? t('required') : t('optional')}${hint ? ', ' + hint : ''})` })));
      if (g.kind === 'single' && !g.required) {
        fs.append(choice('radio', `g${g.id}`, '', `— ${AT.lang === 'en' ? 'none' : 'geen'} —`, 0, !g.options.some((o) => chosen.includes(o.id)), false));
      }
      for (const o of g.options) {
        fs.append(choice(g.kind === 'single' ? 'radio' : 'checkbox', `g${g.id}`, o.id, pick(o.name), o.price_cents, chosen.includes(o.id), o.sold_out));
      }
      body.push(fs);
    }
    body.push(el('div', { class: 'field' },
      el('label', { for: 'dish-note' }, t('item_note'), ' ', el('span', { class: 'muted small', text: `(${t('optional')})` })),
      el('input', { id: 'dish-note', type: 'text', maxlength: '200', placeholder: t('item_note_ph'), value: existing ? existing.note : '' })));
    body.push(el('p', { class: 'alert', id: 'dish-error', hidden: true }));
    put($('dish-body'), ...body);
    $('dish-body').querySelectorAll('input[type=checkbox], input[type=radio]').forEach((i) => i.addEventListener('change', updateDish));
    updateDish();
    $('dish-dialog').showModal();
  }

  function choice(type, name, value, label, price, checked, soldOut) {
    return el('label', { class: 'choice' + (soldOut ? ' disabled' : '') },
      el('input', { type, name, value: String(value), checked, disabled: soldOut }),
      el('span', { class: 'grow', text: label }),
      soldOut ? el('span', { class: 'tag tag-out', text: t('sold_out') }) : price ? el('span', { class: 'muted', text: '+ ' + AT.money(price) }) : null);
  }

  function selectedOptions() {
    return [...$('dish-body').querySelectorAll('input:checked')].map((i) => Number(i.value)).filter((v) => v > 0);
  }

  function updateDish() {
    const p = dlg.product;
    // maximaal aantal keuzes per groep afdwingen
    for (const g of p.option_groups) {
      if (g.kind !== 'multi' || !g.max_select) continue;
      const boxes = [...$('dish-body').querySelectorAll(`fieldset[data-group="${g.id}"] input[type=checkbox]`)];
      const n = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => {
        const o = g.options.find((x) => String(x.id) === b.value);
        b.disabled = o.sold_out || (!b.checked && n >= g.max_select);
      });
    }
    $('qty-val').textContent = dlg.qty;
    const total = unitPrice(p, selectedOptions()) * dlg.qty;
    $('dish-add').textContent = `${dlg.editIndex != null ? t('update_item') : t('add_to_order')} · ${AT.money(total)}`;
  }

  $('qty-minus').onclick = () => { dlg.qty = Math.max(1, dlg.qty - 1); updateDish(); };
  $('qty-plus').onclick = () => { dlg.qty = Math.min(20, dlg.qty + 1); updateDish(); };
  $('dish-close').onclick = () => $('dish-dialog').close();
  $('dish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = dlg.product;
    const options = selectedOptions();
    const missing = p.option_groups.find((g) => g.required && !g.options.some((o) => options.includes(o.id)));
    if (missing) {
      const err = $('dish-error');
      err.hidden = false;
      err.textContent = `${pick(missing.name)}: ${t('err_option_required')}`;
      return;
    }
    const line = { productId: p.id, quantity: dlg.qty, options, note: $('dish-note').value.trim().slice(0, 200) };
    if (dlg.editIndex != null) cart.splice(dlg.editIndex, 1);
    const same = cart.findIndex((l) => lineKey(l) === lineKey(line));
    if (same >= 0) cart[same].quantity = Math.min(20, cart[same].quantity + line.quantity);
    else cart.push(line);
    saveCart();
    $('dish-dialog').close();
    refreshCart();
  });

  // ---------- winkelwagen ----------
  async function refreshQuote() {
    if (!cart.length) { quote = null; lineErrors = new Map(); return; }
    try {
      const body = { items: cart, lang: AT.lang, fulfillment: mode };
      if (mode === 'delivery') body.address = { postcode: $('postcode').value };
      quote = await AT.api('/api/orders/quote', { method: 'POST', body });
      lineErrors = new Map(quote.errors.filter((e) => e.index != null).map((e) => [e.index, e.code]));
    } catch {
      quote = null;
    }
  }

  async function refreshCart() {
    renderCart();
    await refreshQuote();
    renderCart();
    if (view === 'checkout') renderSummary();
  }

  function cartTotals() {
    if (quote) {
      return {
        subtotal: quote.subtotal_cents, fee: quote.fee_cents, feeLabel: quote.fee_label,
        delivery: mode === 'delivery' ? quote.delivery_fee_cents : 0, total: quote.total_cents,
      };
    }
    let subtotal = 0;
    for (const l of cart) { const p = products.get(l.productId); if (p) subtotal += unitPrice(p, l.options) * l.quantity; }
    const fee = cart.length ? site.ordering.fee_cents : 0;
    const delivery = mode === 'delivery' && zoneCheck?.ok ? zoneCheck.fee_cents : 0;
    return { subtotal, fee, feeLabel: pick(site.ordering.fee_label), delivery, total: subtotal + fee + delivery };
  }

  function totalsTable() {
    const x = cartTotals();
    return el('table', { class: 'totals' }, el('tbody', {},
      el('tr', {}, el('td', { text: t('subtotal') }), el('td', { text: AT.money(x.subtotal) })),
      x.fee ? el('tr', {}, el('td', { text: x.feeLabel }), el('td', { text: AT.money(x.fee) })) : null,
      x.delivery ? el('tr', {}, el('td', { text: t('delivery_fee') }), el('td', { text: AT.money(x.delivery) })) : null,
      el('tr', { class: 'grand' }, el('td', { text: t('total') }), el('td', { text: AT.money(x.total) }))));
  }

  // Melding als het minimum bestelbedrag voor bezorgen nog niet gehaald is.
  function minimumNote() {
    const d = quote?.delivery;
    if (mode !== 'delivery' || !d || d.error !== 'below_minimum') return null;
    return el('p', { class: 'notice small', text: t('min_short', AT.money(d.min_order_cents - quote.subtotal_cents)) });
  }

  function cartLines(editable) {
    return el('ul', { class: 'cart-lines' }, cart.map((l, i) => {
      const p = products.get(l.productId);
      const err = lineErrors.get(i);
      const name = p ? pick(p.name) : '?';
      const opts = p ? optionNames(p, l.options) : [];
      return el('li', { class: 'cart-line' + (err || !p ? ' has-error' : '') },
        el('div', { class: 'cart-line-top' },
          el('strong', {}, `${l.quantity}× ${name}`),
          el('span', { text: p ? AT.money(unitPrice(p, l.options) * l.quantity) : '' })),
        opts.length ? el('div', { class: 'opts', text: opts.join(', ') }) : null,
        l.note ? el('div', { class: 'opts', text: `“${l.note}”` }) : null,
        err || !p ? el('div', { class: 'opts', text: `⚠ ${name} ${t('err_' + (err || 'product_unavailable'))}` }) : null,
        editable ? el('div', { class: 'cart-line-actions' },
          el('div', { class: 'qty' },
            el('button', { type: 'button', 'aria-label': '−', onclick: () => changeQty(i, -1) }, '−'),
            el('span', { text: String(l.quantity) }),
            el('button', { type: 'button', 'aria-label': '+', onclick: () => changeQty(i, 1) }, '+')),
          p && !p.sold_out ? el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => { closeCartPanel(); openDish(p, i); } }, t('edit')) : null,
          el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => removeLine(i) }, t('remove'))) : null);
    }));
  }

  function changeQty(i, d) {
    cart[i].quantity = Math.max(1, Math.min(20, cart[i].quantity + d));
    saveCart();
    refreshCart();
  }
  function removeLine(i) {
    cart.splice(i, 1);
    saveCart();
    refreshCart();
  }

  function renderCart() {
    const count = cart.reduce((s, l) => s + l.quantity, 0);
    const body = $('cart-body');
    if (!cart.length) {
      put(body, el('p', { class: 'muted', text: t('cart_empty') }));
    } else {
      const hasErr = lineErrors.size > 0 || cart.some((l) => !products.has(l.productId));
      put(body, 
        cartLines(true),
        totalsTable(),
        minimumNote(),
        el('p', { class: 'small muted', text: t('incl_vat') }),
        view === 'menu' ? el('button', {
          type: 'button', class: 'btn btn-primary btn-block', disabled: hasErr || site.ordering.paused,
          onclick: goCheckout,
        }, t('to_checkout')) : null);
    }
    const bar = $('cart-bar');
    bar.hidden = !count || view !== 'menu';
    $('cart-bar-btn').textContent = `${t('view_order')} (${count}) · ${AT.money(cartTotals().total)}`;
  }

  $('cart-bar-btn').onclick = () => { $('cart').classList.add('open'); $('cart-close').focus(); };
  function closeCartPanel() { $('cart').classList.remove('open'); }
  $('cart-close').onclick = closeCartPanel;

  // ---------- afrekenen ----------
  function goCheckout() {
    closeCartPanel();
    view = 'checkout';
    $('menu-view').hidden = true;
    $('checkout-view').hidden = false;
    renderCart();
    renderCheckout();
    loadDates();
    window.scrollTo({ top: 0 });
  }
  $('back-to-menu').onclick = () => {
    view = 'menu';
    $('menu-view').hidden = false;
    $('checkout-view').hidden = true;
    renderCart();
  };

  // Welke soorten zijn mogelijk, en welke is gekozen (bewaard in deze browsersessie).
  function availableModes() {
    return ['pickup', 'delivery'].filter((m) => (m === 'pickup' ? site.ordering.pickup_enabled : site.ordering.delivery_enabled));
  }
  function initMode() {
    const modes = availableModes();
    let saved = null;
    try { saved = sessionStorage.getItem('at_mode'); } catch { /* leeg */ }
    mode = modes.includes(saved) ? saved : modes.includes(mode) ? mode : modes[0] || 'pickup';
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    try { sessionStorage.setItem('at_mode', m); } catch { /* leeg */ }
    sel.time = null;
    renderCheckout();
    loadDates();
    refreshCart();
  }

  function renderCheckout() {
    const o = site.ordering;
    const modes = availableModes();
    $('f-mode').hidden = modes.length < 2;
    put($('mode-options'), ...modes.map((m) => el('label', { class: 'choice' },
      el('input', { type: 'radio', name: 'mode', value: m, checked: m === mode, 'aria-label': t(m === 'delivery' ? 'mode_delivery' : 'mode_pickup'), onchange: () => setMode(m) }),
      el('strong', { text: t(m === 'delivery' ? 'mode_delivery' : 'mode_pickup') }),
      el('span', { class: 'small muted', text: t(m === 'delivery' ? 'mode_delivery_hint' : 'mode_pickup_hint') }))));
    const delivering = mode === 'delivery';
    $('f-address').hidden = !delivering;
    $('date-legend').textContent = t(delivering ? 'delivery_date' : 'pickup_date');
    $('time-legend').textContent = t(delivering ? 'delivery_time' : 'pickup_time');
    renderZoneInfo();

    const pay = [];
    const choice = (value, title, hint) => el('label', { class: 'choice' },
      el('input', { type: 'radio', name: 'pay', value, 'aria-label': title }),
      el('span', { class: 'grow' }, el('strong', { text: title }), el('br'), el('span', { class: 'small muted', text: hint })));
    if (o.pay_online) pay.push(choice('online', t('pay_online'), o.test_payments ? t('pay_online_test') : t('pay_online_hint')));
    if (!delivering && o.pay_at_pickup) pay.push(choice('pickup', t('pay_pickup'), t('pay_pickup_hint')));
    if (delivering && o.pay_on_delivery) pay.push(choice('on_delivery', t('pay_delivery'), t('pay_delivery_hint')));
    const previous = document.querySelector('input[name=pay]:checked')?.value;
    put($('pay-options'), ...pay);
    const radios = [...$('pay-options').querySelectorAll('input')];
    (radios.find((r) => r.value === previous) || radios[0])?.click();
    radios.forEach((i) => i.addEventListener('change', updateSubmitLabel));
    try {
      const saved = JSON.parse(sessionStorage.getItem('at_details') || '{}');
      for (const k of ['name', 'email', 'phone', 'note', 'street', 'houseNumber', 'postcode', 'city']) if (saved[k] && !$(k).value) $(k).value = saved[k];
    } catch { /* geen opgeslagen gegevens */ }
    if (delivering && $('postcode').value && !zoneCheck) checkPostcode();
    renderSummary();
    updateSubmitLabel();
  }

  // Postcode direct controleren zodra die compleet is.
  let pcTimer = null;
  $('postcode').addEventListener('input', () => {
    clearTimeout(pcTimer);
    zoneCheck = null;
    renderZoneInfo();
    pcTimer = setTimeout(checkPostcode, 350);
  });
  async function checkPostcode() {
    const pc = $('postcode').value;
    if (!validPostcode(pc)) { zoneCheck = null; renderZoneInfo(); return; }
    $('zone-info').className = 'zone-info muted';
    $('zone-info').textContent = t('zone_checking');
    try {
      zoneCheck = await AT.api(`/api/delivery/check?postcode=${encodeURIComponent(pc)}`);
    } catch { zoneCheck = null; }
    renderZoneInfo();
    refreshCart();
  }
  function renderZoneInfo() {
    const z = $('zone-info');
    if (!zoneCheck) { z.className = 'zone-info'; z.textContent = ''; return; }
    if (!zoneCheck.ok) {
      z.className = 'zone-info err';
      z.textContent = zoneCheck.reason === 'outside_delivery_area' ? t('err_outside_delivery_area') : t('err_field_postcode');
      return;
    }
    z.className = 'zone-info ok';
    z.textContent = t('zone_ok', pick(zoneCheck.zone.name), AT.money(zoneCheck.fee_cents), zoneCheck.min_order_cents ? AT.money(zoneCheck.min_order_cents) : '');
  }

  function renderSummary() {
    const a = addressInput();
    const delivering = mode === 'delivery';
    put($('checkout-summary'), cartLines(false), totalsTable(), minimumNote(),
      sel.date && sel.time ? el('p', { class: 'small' }, el('strong', { text: `${t(delivering ? 'delivery' : 'pickup')}: ` }), `${AT.dateLong(sel.date)} ${t('at')} ${sel.time}`) : null,
      delivering && a.street && a.houseNumber ? el('p', { class: 'small' }, el('strong', { text: `${t('delivery_address')}: ` }),
        `${a.street} ${a.houseNumber}, ${a.postcode} ${a.city}`) : null);
  }

  function updateSubmitLabel() {
    const m = document.querySelector('input[name=pay]:checked')?.value;
    $('submit-btn').textContent = submitting ? t('placing') : `${m === 'online' ? t('place_and_pay') : t('place_order')} · ${AT.money(cartTotals().total)}`;
  }

  async function loadDates() {
    put($('dates'), el('span', { class: 'muted', text: t('loading') }));
    try {
      dates = (await AT.api(`/api/pickup/dates?mode=${mode}`)).dates;
    } catch {
      put($('dates'), el('p', { class: 'alert', text: t('err_network') }));
      return;
    }
    if (!sel.date || !dates.find((d) => d.date === sel.date && d.available)) sel.date = dates.find((d) => d.available)?.date || null;
    renderDates();
    loadSlots();
  }

  function renderDates() {
    put($('dates'), ...dates.map((d, i) => {
      const label = i === 0 ? t('today') : i === 1 ? t('tomorrow') : AT.dateShort(d.date);
      const reason = !d.open ? t('reason_' + (d.reason || 'closed_day')) : !d.available ? t('reason_full') : '';
      return el('button', {
        type: 'button', class: 'chip', disabled: !d.available, 'aria-current': String(d.date === sel.date),
        title: AT.pick(d.closure) || '', onclick: () => { sel.date = d.date; sel.time = null; renderDates(); loadSlots(); },
      }, label, reason ? el('span', { class: 'small muted', text: ` · ${reason}` }) : null);
    }));
    if (!dates.some((d) => d.available)) $('slot-hint').textContent = t('no_slots');
  }

  async function loadSlots() {
    put($('slots'), );
    if (!sel.date) return;
    let day;
    try { day = await AT.api(`/api/pickup/slots?date=${encodeURIComponent(sel.date)}&mode=${mode}`); } catch {
      put($('slots'), el('p', { class: 'alert', text: t('err_network') }));
      return;
    }
    if (sel.time && !day.slots.find((s) => s.time === sel.time && s.available)) sel.time = null;
    put($('slots'), ...day.slots.map((s) => el('button', {
      type: 'button', disabled: !s.available, 'aria-pressed': String(s.time === sel.time),
      'aria-label': s.available ? s.time : `${s.time} (${t('full')})`,
      onclick: () => { sel.time = s.time; loadSlots(); renderSummary(); },
    }, s.time)));
    $('slot-hint').textContent = day.slots.length ? (mode === 'delivery' ? t('delivery_time_hint') : '') : t('no_slots');
  }

  function clearFieldErrors() {
    document.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    document.querySelectorAll('.field .err').forEach((e) => e.remove());
    $('form-error').hidden = true;
  }
  function fieldError(id, text) {
    const f = $(id);
    f.classList.add('invalid');
    f.append(el('p', { class: 'err', text }));
  }
  function formError(text) {
    $('form-error').hidden = false;
    $('form-error').textContent = text;
    $('form-error').scrollIntoView({ block: 'center' });
  }

  $('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    clearFieldErrors();
    const customer = { name: $('name').value.trim(), email: $('email').value.trim(), phone: $('phone').value.trim() };
    const note = $('note').value.trim();
    const delivering = mode === 'delivery';
    const address = addressInput();
    try { sessionStorage.setItem('at_details', JSON.stringify({ ...customer, note, ...address })); } catch { /* niet beschikbaar */ }
    const paymentMethod = document.querySelector('input[name=pay]:checked')?.value;
    let ok = true;
    if (delivering) {
      if (!validPostcode(address.postcode)) { fieldError('f-postcode', t('err_field_postcode')); ok = false; }
      else if (zoneCheck && !zoneCheck.ok) { fieldError('f-postcode', t('err_outside_delivery_area')); ok = false; }
      if (!/^\d/.test(address.houseNumber)) { fieldError('f-houseNumber', t('err_field_houseNumber')); ok = false; }
      if (address.street.length < 2) { fieldError('f-street', t('err_field_street')); ok = false; }
      if (address.city.length < 2) { fieldError('f-city', t('err_field_city')); ok = false; }
    }
    if (!sel.date || !sel.time) { fieldError('f-time', t('err_invalid_pickup')); ok = false; }
    if (customer.name.length < 2) { fieldError('f-name', t('err_field_name')); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email)) { fieldError('f-email', t('err_field_email')); ok = false; }
    if (customer.phone.replace(/\D/g, '').length < 8) { fieldError('f-phone', t('err_field_phone')); ok = false; }
    if (!paymentMethod) { fieldError('f-pay', t('err_payment_method_unavailable')); ok = false; }
    if (!ok) { formError(t('err_invalid_customer')); return; }

    const payload = {
      lang: AT.lang,
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, options: l.options, note: l.note })),
      fulfillment: mode,
      pickup: { date: sel.date, time: sel.time },
      customer, note, paymentMethod,
    };
    if (delivering) payload.address = address;
    // Dezelfde inhoud → dezelfde sleutel, zodat een herhaalde klik of herlaadactie
    // nooit een tweede bestelling maakt.
    const sig = JSON.stringify(payload);
    let attempt = null;
    try { attempt = JSON.parse(sessionStorage.getItem('at_attempt') || 'null'); } catch { /* leeg */ }
    if (!attempt || attempt.sig !== sig) attempt = { sig, key: uuid() };
    try { sessionStorage.setItem('at_attempt', JSON.stringify(attempt)); } catch { /* leeg */ }

    submitting = true;
    $('submit-btn').disabled = true;
    updateSubmitLabel();
    try {
      const r = await AT.api('/api/orders', { method: 'POST', body: { ...payload, idempotencyKey: attempt.key } });
      cart = [];
      saveCart();
      try { sessionStorage.removeItem('at_attempt'); } catch { /* leeg */ }
      if (r.next === 'redirect' && r.checkoutUrl) {
        location.assign(r.checkoutUrl);
        return;
      }
      location.assign(r.statusUrl + (r.paymentError ? `&pe=${encodeURIComponent(r.paymentError)}` : ''));
    } catch (err) {
      submitting = false;
      $('submit-btn').disabled = false;
      updateSubmitLabel();
      handleOrderError(err);
    }
  });

  function handleOrderError(err) {
    const code = err.code;
    if (code === 'network') return formError(t('err_network'));
    if (code === 'cart_invalid') {
      const errs = err.details?.errors || [];
      lineErrors = new Map(errs.filter((x) => x.index != null).map((x) => [x.index, x.code]));
      const general = errs.find((x) => x.index == null);
      reloadCatalog().then(() => { renderCart(); renderSummary(); });
      return formError(general?.code === 'too_many_items' ? t('err_too_many_items', general.max) : general ? AT.errorText(general.code) : t('err_cart_invalid'));
    }
    if (code === 'invalid_customer') {
      const f = err.details?.fields || {};
      if (f.name) fieldError('f-name', t('err_field_name'));
      if (f.email) fieldError('f-email', t('err_field_email'));
      if (f.phone) fieldError('f-phone', t('err_field_phone'));
      return formError(t('err_invalid_customer'));
    }
    if (code === 'invalid_address') {
      const f = err.details?.fields || {};
      for (const k of ['postcode', 'houseNumber', 'street', 'city']) if (f[k]) fieldError(`f-${k}`, t(`err_field_${k}`));
      return formError(t('err_invalid_address'));
    }
    if (code === 'outside_delivery_area') {
      fieldError('f-postcode', t('err_outside_delivery_area'));
      return formError(t('err_outside_delivery_area'));
    }
    if (code === 'below_minimum') {
      refreshCart();
      return formError(t('err_below_minimum', AT.money(err.details?.min_order_cents || 0)));
    }
    if (['slot_full', 'pickup_time_unavailable', 'pickup_date_unavailable'].includes(code)) {
      sel.time = null;
      loadDates();
      fieldError('f-time', AT.errorText(code));
      return formError(AT.errorText(code));
    }
    if (code === 'ordering_paused') { site.ordering.paused = true; renderPaused(); }
    formError(AT.errorText(code));
  }

  // ---------- laden ----------
  async function reloadCatalog() {
    const c = await AT.api('/api/catalog');
    categories = c.categories;
    products = new Map();
    for (const cat of categories) for (const p of cat.products) products.set(p.id, p);
  }

  function renderPaused() {
    const p = $('paused');
    p.hidden = !site.ordering.paused;
    p.textContent = AT.pick(site.ordering.pause_message) || t('ordering_paused');
  }

  function renderAll() {
    AT.renderChrome(site);
    const both = availableModes().length > 1;
    const title = both ? t('order_title_both') : site.ordering.delivery_enabled && !site.ordering.pickup_enabled ? t('mode_delivery') : t('order_title');
    document.querySelector('h1[data-i18n="order_title"]').textContent = title;
    document.querySelector('[data-i18n="order_intro"]').textContent = both ? t('order_intro_both') : t('order_intro');
    document.title = `${title} – ${site.business.name}`;
    const b = site.business;
    const zones = site.delivery.zones.map((z) => pick(z.name)).join(', ');
    put($('pickup-location'),
      site.ordering.pickup_enabled ? el('span', {}, el('strong', { text: `${t('pickup_at')}: ` }), `${b.name}, ${[b.street, `${b.postal_code} ${b.city}`.trim()].filter(Boolean).join(', ')}`) : null,
      site.ordering.pickup_enabled && site.ordering.delivery_enabled ? el('br') : null,
      site.ordering.delivery_enabled && zones ? el('span', {}, el('strong', { text: `${t('delivery_in')}: ` }), zones) : null);
    renderPaused();
    renderMenu();
    renderCart();
    if (view === 'checkout') { renderCheckout(); renderDates(); loadSlots(); }
  }

  async function init() {
    try {
      site = await AT.api('/api/site');
      await reloadCatalog();
    } catch {
      $('load-error').hidden = false;
      $('load-error').textContent = t('err_network');
      return;
    }
    cart = cart.filter((l) => l && Number.isInteger(l.productId) && Array.isArray(l.options));
    initMode();
    ['street', 'houseNumber', 'city'].forEach((id) => $(id).addEventListener('input', () => { if (view === 'checkout') renderSummary(); }));
    renderAll();
    if ($('postcode').value) checkPostcode();
    refreshCart();
  }

  document.addEventListener('langchange', async () => {
    if (!site) return;
    renderAll();
    await refreshQuote();
    renderCart();
    if (view === 'checkout') renderSummary();
  });
  init();
})();
