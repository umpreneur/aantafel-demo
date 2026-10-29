/* Alleen voor de statische etalageversie (Netlify). Vervangt de server-API door
   berekeningen in de browser met dezelfde regels als de server (prijzen, keuzes,
   tijdvakken, bezorggebieden, minimum bestelbedrag). Er wordt niets opgeslagen of
   verstuurd: een "bestelling" bestaat alleen in deze browsersessie en wordt op de
   bevestigingspagina duidelijk als voorbeeld getoond. */
(function () {
  'use strict';
  const original = AT.api;
  const once = (fn) => { let p = null; return () => (p ||= fn()); };
  const config = once(() => fetch(AT.base + '/data/config.json').then((r) => r.json()));
  const site = once(() => original('/api/site'));
  const catalog = once(() => original('/api/catalog'));
  const fail = (status, code, details) => { throw Object.assign(new Error(code), { status, code, details }); };

  // ---- tijd ----
  function nowParts(tz) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  }
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const weekday = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

  async function slotsFor(date, mode) {
    const c = await config();
    mode = mode === 'delivery' ? 'delivery' : 'pickup';
    const conf = c[mode];
    const now = nowParts(c.timezone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { date, mode, open: false, reason: 'invalid_date', slots: [] };
    if (date < now.date) return { date, mode, open: false, reason: 'past', slots: [] };
    if (date > addDays(now.date, conf.days_ahead)) return { date, mode, open: false, reason: 'too_far', slots: [] };
    const closure = c.closures.find((x) => date >= x.date_from && date <= x.date_to);
    if (closure) return { date, mode, open: false, reason: 'closure', closure: { nl: closure.reason_nl, en: closure.reason_en }, slots: [] };
    const ranges = conf.hours[String(weekday(date))] || [];
    if (!ranges.length) return { date, mode, open: false, reason: 'closed_day', slots: [] };
    const earliest = date === now.date ? now.minutes + conf.prep_min : -1;
    const slots = [];
    for (const r of ranges) {
      for (let t = toMin(r.from); t <= toMin(r.to); t += conf.interval_min) {
        if (t >= earliest) slots.push({ time: fromMin(t), available: true, remaining: conf.max_per_slot });
      }
    }
    if (!slots.length) return { date, mode, open: false, reason: 'no_more_today', slots: [] };
    return { date, mode, open: true, slots };
  }

  async function upcomingDates(mode) {
    const c = await config();
    const today = nowParts(c.timezone).date;
    const out = [];
    for (let i = 0; i <= c[mode === 'delivery' ? 'delivery' : 'pickup'].days_ahead; i++) {
      const d = await slotsFor(addDays(today, i), mode);
      out.push({ date: d.date, open: d.open, reason: d.reason || null, closure: d.closure || null, available: d.slots.length > 0 });
    }
    return { dates: out };
  }

  // ---- bezorggebieden ----
  function normalizePostcode(s) {
    const m = /^\s*([1-9]\d{3})\s?([a-zA-Z]{2})\s*$/.exec(String(s ?? ''));
    return m && !['SA', 'SD', 'SS'].includes(m[2].toUpperCase()) ? `${m[1]} ${m[2].toUpperCase()}` : null;
  }
  const inRanges = (text, n) => String(text).split(/[,;\s]+/).filter(Boolean).some((p) => {
    const m = /^(\d{4})(?:-(\d{4}))?$/.exec(p);
    return m && n >= Number(m[1]) && n <= Number(m[2] || m[1]);
  });
  async function findZone(postcode) {
    const pc = normalizePostcode(postcode);
    if (!pc) return null;
    return (await config()).delivery.zones.find((z) => z.active !== false && inRanges(z.postcodes, Number(pc.slice(0, 4)))) || null;
  }
  async function deliveryCheck(postcode) {
    const pc = normalizePostcode(postcode);
    if (!pc) return { ok: false, reason: 'invalid_postcode' };
    const z = await findZone(pc);
    if (!z) return { ok: false, postcode: pc, reason: 'outside_delivery_area' };
    return { ok: true, postcode: pc, zone: { name: { nl: z.name_nl, en: z.name_en } }, fee_cents: z.fee_cents, min_order_cents: z.min_order_cents };
  }

  // ---- prijzen (zelfde regels als src/pricing.js) ----
  async function quote(body) {
    const lang = body.lang === 'en' ? 'en' : 'nl';
    const pick = (o) => (lang === 'en' && o.en ? o.en : o.nl);
    const products = new Map();
    for (const c of (await catalog()).categories) for (const p of c.products) products.set(p.id, p);
    const c = await config();
    const errors = [];
    const lines = [];
    (body.items || []).forEach((it, index) => {
      const p = products.get(Number(it.productId));
      if (!p || !p.orderable) return errors.push({ index, code: 'product_unavailable' });
      if (p.sold_out) return errors.push({ index, code: 'sold_out' });
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 20) return errors.push({ index, code: 'invalid_quantity' });
      const chosen = [];
      for (const oid of it.options || []) {
        let hit = null;
        for (const g of p.option_groups) { const o = g.options.find((x) => x.id === Number(oid)); if (o) hit = { g, o }; }
        if (!hit) return errors.push({ index, code: 'invalid_options' });
        if (hit.o.sold_out) return errors.push({ index, code: 'option_sold_out' });
        chosen.push(hit);
      }
      for (const g of p.option_groups) {
        const n = chosen.filter((x) => x.g.id === g.id).length;
        if (g.required && n < 1) return errors.push({ index, code: 'option_required' });
        if (g.kind === 'single' && n > 1) return errors.push({ index, code: 'invalid_options' });
      }
      const unit = p.price_cents + chosen.reduce((s, x) => s + x.o.price_cents, 0);
      lines.push({ name: pick(p.name), quantity: q, unit_price_cents: unit, line_total_cents: unit * q, options: chosen.map((x) => pick(x.o.name)), note: String(it.note || '') });
    });
    if (!(body.items || []).length) errors.push({ index: null, code: 'cart_empty' });
    const subtotal = lines.reduce((s, l) => s + l.line_total_cents, 0);
    const fee = lines.length ? c.fee_cents : 0;
    let delivery = null;
    if (body.fulfillment === 'delivery' && normalizePostcode(body.address?.postcode)) {
      const z = await findZone(body.address.postcode);
      delivery = !z ? { error: 'outside_delivery_area' } : {
        zone: { name: { nl: z.name_nl, en: z.name_en } }, fee_cents: z.fee_cents, min_order_cents: z.min_order_cents,
        ...(subtotal < z.min_order_cents ? { error: 'below_minimum' } : {}),
      };
    }
    const deliveryFee = delivery && delivery.error !== 'outside_delivery_area' ? delivery.fee_cents : 0;
    return {
      lines, errors, subtotal_cents: subtotal, fee_cents: fee, fee_label: lang === 'en' ? c.fee_label_en : c.fee_label_nl,
      delivery, delivery_fee_cents: deliveryFee, total_cents: subtotal + fee + deliveryFee,
    };
  }

  // ---- voorbeeldbestelling (alleen in deze browsersessie) ----
  async function createOrder(body) {
    const q = await quote(body);
    if (q.errors.length) fail(409, 'cart_invalid', { errors: q.errors });
    const delivering = body.fulfillment === 'delivery';
    if (delivering) {
      if (!q.delivery) fail(422, 'invalid_address', { fields: { postcode: 'invalid' } });
      if (q.delivery.error === 'outside_delivery_area') fail(409, 'outside_delivery_area');
      if (q.delivery.error === 'below_minimum') fail(409, 'below_minimum', { min_order_cents: q.delivery.min_order_cents });
    }
    const day = await slotsFor(body.pickup?.date, body.fulfillment);
    if (!day.open) fail(409, 'pickup_date_unavailable', { reason: day.reason });
    if (!day.slots.some((s) => s.time === body.pickup?.time)) fail(409, 'pickup_time_unavailable');
    const s = await site();
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const a = body.address || {};
    const [user, domain] = String(body.customer?.email || '@').split('@');
    const order = {
      id, number: `VB${String(Date.now()).slice(-4)}`, status: 'received', showcase: true, demo: true,
      payment_method: body.paymentMethod, payment_status: delivering ? 'pay_on_delivery' : 'pay_at_pickup', can_retry_payment: false,
      fulfillment: delivering ? 'delivery' : 'pickup', pickup: { date: body.pickup.date, time: body.pickup.time },
      address: delivering ? { street: a.street, house_number: a.houseNumber, postcode: normalizePostcode(a.postcode), city: a.city } : null,
      delivery_fee_cents: q.delivery_fee_cents, customer: { name: body.customer?.name, email_masked: `${user.slice(0, 2)}…@${domain}` },
      note: body.note || '', lang: body.lang, items: q.lines,
      subtotal_cents: q.subtotal_cents, fee_cents: q.fee_cents, fee_label: q.fee_label, total_cents: q.total_cents,
      business: { name: s.business.name, street: s.business.street, postal_code: s.business.postal_code, city: s.business.city, phone: s.business.phone },
    };
    sessionStorage.setItem(`at_showcase_${id}`, JSON.stringify(order));
    return { orderId: id, token: 'voorbeeld', number: order.number, next: 'status', statusUrl: `${AT.base}/bestelling?id=${id}&t=voorbeeld&lang=${body.lang}` };
  }

  AT.api = async function (path, opts = {}) {
    const u = new URL(path, location.origin);
    const p = u.pathname;
    const body = opts.body || {};
    if (p === '/api/orders/quote') return quote(body);
    if (p === '/api/orders' && opts.method === 'POST') return createOrder(body);
    if (p === '/api/pickup/dates') return upcomingDates(u.searchParams.get('mode'));
    if (p === '/api/pickup/slots') return slotsFor(u.searchParams.get('date') || '', u.searchParams.get('mode'));
    if (p === '/api/delivery/check') return deliveryCheck(u.searchParams.get('postcode'));
    const m = /^\/api\/orders\/([^/]+)$/.exec(p);
    if (m) {
      const raw = sessionStorage.getItem(`at_showcase_${m[1]}`);
      if (!raw) fail(404, 'order_not_found');
      return JSON.parse(raw);
    }
    return original(path, opts);
  };
})();
