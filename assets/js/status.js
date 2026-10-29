/* Bestelstatus / bevestiging. Toont alleen wat de server heeft opgeslagen; zonder
   antwoord van de server wordt nooit "gelukt" getoond. */
(function () {
  'use strict';
  const { el, t, put } = AT;
  const box = document.getElementById('status');
  const id = new URLSearchParams(location.search).get('id') || location.pathname.split('/').pop();
  const params = new URLSearchParams(location.search);
  const token = params.get('t') || '';
  const startError = params.get('pe');
  let site = null;
  let order = null;
  let polls = 0;
  let timer = null;
  let paying = false;
  let payError = null;

  async function load(refresh) {
    try {
      order = await AT.api(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}${refresh ? '&refresh=1' : ''}`);
      render();
      schedule();
    } catch (e) {
      if (order && e.code === 'network') { schedule(); return; }
      put(box, 
        el('p', { class: 'alert', text: e.code === 'order_not_found' ? AT.errorText('generic') : t('load_failed') }),
        el('button', { class: 'btn', type: 'button', onclick: () => load(true) }, t('retry')));
    }
  }

  function schedule() {
    clearTimeout(timer);
    const waiting = order && order.status === 'pending_payment' && order.payment_status === 'open';
    if (waiting && polls < 60) {
      polls++;
      timer = setTimeout(() => load(true), polls < 10 ? 2000 : 5000);
    }
  }

  async function pay() {
    if (paying) return;
    paying = true;
    payError = null;
    render();
    try {
      const r = await AT.api(`/api/orders/${encodeURIComponent(id)}/pay`, { method: 'POST', body: { t: token } });
      if (r.checkoutUrl) { location.assign(r.checkoutUrl); return; }
      await load(true);
    } catch (e) {
      payError = e.code;
      await load(false);
    } finally {
      paying = false;
      render();
    }
  }

  function pill(text, kind) { return el('span', { class: `status-pill ${kind || ''}`, text }); }

  function headline() {
    const o = order;
    if (o.status === 'cancelled') {
      return o.payment_method === 'online' && o.payment_status !== 'paid'
        ? [pill(t('st_cancelled'), 'err'), el('h1', { text: t('expired_title') }), el('p', { text: t('expired_text') })]
        : [pill(t('st_cancelled'), 'err'), el('h1', { text: t('cancelled_title') }), el('p', { text: t('cancelled_text') })];
    }
    if (o.status === 'pending_payment') {
      const retryBtn = o.can_retry_payment
        ? el('button', { type: 'button', class: 'btn btn-primary', disabled: paying, onclick: pay },
          paying ? t('placing') : o.payment_status === 'open' ? t('continue_payment') : t('retry_payment'))
        : null;
      const err = payError ? el('p', { class: 'alert', text: AT.errorText(payError) }) : null;
      const hold = o.hold_until ? el('p', { class: 'small muted', text: `${t('hold_until')} ${AT.time(o.hold_until)}.` }) : null;
      if (o.payment_status === 'open') {
        return [pill(t('ps_open'), 'warn'), el('h1', {}, el('span', { class: 'spinner', 'aria-hidden': 'true' }), ' ', t('waiting_title')),
          el('p', { text: t('waiting_text') }), err, hold, retryBtn];
      }
      if (o.payment_status === 'not_started') {
        return [pill(t('ps_not_started'), 'err'), el('h1', { text: t('start_failed_title') }), el('p', { text: t('start_failed_text') }),
          startError ? el('p', { class: 'small muted', text: AT.errorText(startError) }) : null, err, hold, retryBtn];
      }
      const title = o.payment_status === 'canceled' ? t('canceled_title') : t('failed_title');
      return [pill(t('ps_' + o.payment_status), 'err'), el('h1', { text: title }), el('p', { text: t('failed_text') }), err, hold, retryBtn];
    }
    if (o.showcase) {
      // Etalageversie: nooit "ontvangen" melden, want er is niets opgeslagen of verstuurd.
      return [pill(t('showcase_pill'), 'warn'), el('h1', { text: t('showcase_title') }), el('p', { class: 'notice', text: t('showcase_text') })];
    }
    return [
      pill(t('st_' + o.status), 'ok'),
      el('h1', { text: t('thanks_title') }),
      el('p', { text: o.payment_status === 'paid' ? t('thanks_paid') : ['paid_at_pickup', 'paid_on_delivery'].includes(o.payment_status) ? t('ps_' + o.payment_status) : o.payment_method === 'on_delivery' ? t('thanks_delivery') : t('thanks_pickup') }),
    ];
  }

  function render() {
    if (!order) return;
    if (site) AT.renderChrome({ ...site, demo: order.demo || site.demo });
    const o = order;
    const b = o.business;
    const lines = el('ul', { class: 'cart-lines' }, o.items.map((i) => el('li', { class: 'cart-line' },
      el('div', { class: 'cart-line-top' }, el('strong', {}, `${i.quantity}× ${i.name}`), el('span', { text: AT.money(i.line_total_cents) })),
      i.options.length ? el('div', { class: 'opts', text: i.options.join(', ') }) : null,
      i.note ? el('div', { class: 'opts', text: `“${i.note}”` }) : null)));
    const totals = el('table', { class: 'totals' }, el('tbody', {},
      el('tr', {}, el('td', { text: t('subtotal') }), el('td', { text: AT.money(o.subtotal_cents) })),
      o.fee_cents ? el('tr', {}, el('td', { text: o.fee_label }), el('td', { text: AT.money(o.fee_cents) })) : null,
      o.delivery_fee_cents ? el('tr', {}, el('td', { text: t('delivery_fee') }), el('td', { text: AT.money(o.delivery_fee_cents) })) : null,
      el('tr', { class: 'grand' }, el('td', { text: t('total') }), el('td', { text: AT.money(o.total_cents) }))));
    const confirmed = !['pending_payment', 'cancelled'].includes(o.status);
    put(box, 
      ...headline(),
      el('p', { class: 'muted small', text: t('order_number') }),
      el('p', { class: 'order-number', text: o.number }),
      el('dl', { class: 'facts' },
        el('dt', { text: t(o.fulfillment === 'delivery' ? 'delivery' : 'pickup') }), el('dd', { text: `${AT.dateLong(o.pickup.date)} ${t('at')} ${o.pickup.time}` }),
        el('dt', { text: t('payment_label') }), el('dd', { text: t('ps_' + o.payment_status) }),
        o.address
          ? [el('dt', { text: t('delivery_address') }), el('dd', {}, `${o.address.street} ${o.address.house_number}`, el('br'), `${o.address.postcode} ${o.address.city}`)]
          : [el('dt', { text: t('address') }), el('dd', {}, b.name, el('br'), b.street, el('br'), `${b.postal_code} ${b.city}`)],
        b.phone ? el('dt', { text: t('phone') }) : null, b.phone ? el('dd', { text: b.phone }) : null),
      lines, totals,
      confirmed && !o.showcase ? el('p', { class: 'small muted', text: o.demo ? t('demo_no_mail') : `${t('confirmation_sent')} ${o.customer.email_masked}.` }) : null,
      el('p', {},
        el('a', { class: 'btn btn-small', href: AT.link('/'), text: t('to_home') }), ' ',
        o.status === 'cancelled' ? el('a', { class: 'btn btn-small btn-primary', href: AT.link('/bestellen'), text: t('new_order') }) : null));
    document.title = `${t('order_number')} ${o.number} – ${b.name}`;
  }

  document.addEventListener('langchange', render);
  (async () => {
    try { site = await AT.api('/api/site'); } catch { /* kop zonder sitegegevens */ }
    if (site) AT.renderChrome(site);
    load(true);
  })();
})();
