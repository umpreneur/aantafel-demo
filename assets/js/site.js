/* Website: menukaart, verhaal, sfeerbeelden en praktische info uit de centrale catalogus. */
(function () {
  'use strict';
  const { el, t, pick, put } = AT;
  let site = null;
  let cat = null;

  function render() {
    AT.renderChrome(site);
    const c = site.content;
    document.title = `${site.business.name} – ${pick(site.business.tagline)}`;
    document.getElementById('hero-name').textContent = site.business.name;
    document.getElementById('hero-title').textContent = pick({ nl: c.hero_title_nl, en: c.hero_title_en });
    document.getElementById('hero-intro').textContent = pick({ nl: c.intro_nl, en: c.intro_en });
    document.getElementById('hero-photo').hidden = !c.hero_image;
    if (c.hero_image) document.getElementById('hero-img').src = c.hero_image;
    document.querySelectorAll('[data-brand-plain]').forEach((n) => { n.textContent = site.business.name; });
    renderFacts();

    renderMenu();

    document.getElementById('story-title').textContent = pick({ nl: c.story_title_nl, en: c.story_title_en }) || t('nav_story');
    const story = pick({ nl: c.story_nl, en: c.story_en });
    put(document.getElementById('story'), ...story.split(/\n{2,}/).filter(Boolean).map((p) => el('p', { text: p })));
    put(document.getElementById('gallery'), ...(c.gallery || []).map((g) =>
      el('img', { src: g.src, alt: pick({ nl: g.alt_nl, en: g.alt_en }), loading: 'lazy' })));

    renderInfo();
  }

  // Openingstijden van vandaag, kort onder de kop.
  function renderFacts() {
    const ranges = site.opening_hours[String(new Date().getDay())] || [];
    put(document.getElementById('hero-facts'),
      el('span', {}, el('strong', { text: `${t('today_label')}: ` }),
        ranges.length ? ranges.map((r) => `${r.from} – ${r.to}`).join(', ') : t('closed_today')));
  }

  // Prijs zoals op een gedrukte kaart: zonder valutateken (staat onderaan de kaart).
  const plain = (c) => new Intl.NumberFormat(AT.lang === 'en' ? 'en-IE' : 'nl-NL', { minimumFractionDigits: 2 }).format(c / 100);

  function renderMenu() {
    if (!cat) return;
    const cats = cat.categories.filter((c) => c.products.length);
    put(document.getElementById('menu-chips'), ...cats.map((c) => el('a', { href: `#cat-${c.id}`, text: pick(c.name) })));
    put(document.getElementById('menu'), ...cats.map((c) =>
      el('section', { class: 'menu-section', id: `cat-${c.id}`, 'aria-label': pick(c.name) },
        c.image ? el('img', { class: 'menu-section-img', src: c.image, alt: '', loading: 'lazy' }) : null,
        el('div', { class: 'menu-section-head' },
          el('h3', { text: pick(c.name) }),
          pick(c.description) ? el('span', { text: pick(c.description) }) : null),
        el('ul', { class: 'menu-items' }, c.products.map(menuItem)))));
  }

  function menuItem(p) {
    // Keuzes en extra's zoals op een menukaart: "Brood: wit, bruin, desem +0,50"
    const extras = p.option_groups.map((g) => el('p', { class: 'mi-extra' },
      el('em', { text: `${pick(g.name)}: ` }),
      g.options.map((o) => pick(o.name) + (o.price_cents ? ` +${plain(o.price_cents)}` : '')).join(', ')));
    const diets = AT.dietTags(p).map((tag) => tag.textContent).join(' · ');
    return el('li', { class: 'menu-item' + (p.sold_out ? ' is-out' : '') },
      el('div', { class: 'mi-line' },
        el('span', { class: 'mi-name' }, pick(p.name), p.sold_out ? el('span', { class: 'tag tag-out', text: t('sold_out') }) : null),
        el('span', { class: 'mi-dots', 'aria-hidden': 'true' }),
        el('span', { class: 'mi-price', text: plain(p.price_cents) })),
      pick(p.description) ? el('p', { class: 'mi-desc', text: pick(p.description) }) : null,
      extras,
      el('p', { class: 'mi-meta' }, diets ? el('span', { class: 'diet', text: diets + ' · ' }) : null, AT.allergenText(p)));
  }

  function renderInfo() {
    const b = site.business;
    const todayIdx = new Date().getDay();
    const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const ranges = site.opening_hours[String(d)] || [];
      return el('li', { class: 'mi-line' + (d === todayIdx ? ' today' : '') },
        el('span', { text: t('days')[d] }),
        el('span', { class: 'mi-dots', 'aria-hidden': 'true' }),
        el('span', { text: ranges.length ? ranges.map((r) => `${r.from} – ${r.to}`).join(', ') : t('closed') }));
    });
    put(document.getElementById('hours'), ...rows);
    const cl = site.closures || [];
    put(document.getElementById('closures'), ...(cl.length ? [
      el('p', { class: 'small', text: '' }, el('strong', { text: t('closures') + ': ' }),
        cl.map((x) => `${AT.dateShort(x.date_from)}${x.date_to !== x.date_from ? ' – ' + AT.dateShort(x.date_to) : ''}${pick({ nl: x.reason_nl, en: x.reason_en }) ? ' (' + pick({ nl: x.reason_nl, en: x.reason_en }) + ')' : ''}`).join('; ')),
    ] : []));
    put(document.getElementById('address'), 
      el('strong', { text: b.name }), el('br'), b.street, el('br'), `${b.postal_code} ${b.city}`);
    document.getElementById('route').textContent = pick(b.route);
    const mapsUrl = b.maps_url || (b.street && !b.is_fictional
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${b.street}, ${b.postal_code} ${b.city}`)}` : '');
    put(document.getElementById('route-link'), mapsUrl
      ? el('a', { class: 'btn btn-small', href: mapsUrl, target: '_blank', rel: 'noopener', text: t('plan_route') }) : '');
    const zones = site.ordering.delivery_enabled ? site.delivery.zones : [];
    put(document.getElementById('delivery-info'), zones.length ? [
      el('p', { class: 'small', text: '' }, el('strong', { text: t('delivery_zones_intro') })),
      el('ul', { class: 'hours small' }, zones.map((z) => el('li', {},
        el('strong', { text: pick(z.name) }), el('br'),
        el('span', { class: 'muted', text: `${z.postcodes} · ${t('zone_line', AT.money(z.fee_cents), AT.money(z.min_order_cents))}` })))),
    ] : []);
    put(document.getElementById('contact'),
      b.phone ? el('span', {}, b.phone.replace(/[^\d+]/g, '').length >= 8 && !b.is_fictional ? el('a', { href: `tel:${b.phone.replace(/[^\d+]/g, '')}`, text: b.phone }) : b.phone, el('br')) : '',
      b.email ? (b.is_fictional ? b.email : el('a', { href: `mailto:${b.email}`, text: b.email })) : '');
  }

  async function load() {
    try {
      [site, cat] = await Promise.all([AT.api('/api/site'), AT.api('/api/catalog')]);
      render();
    } catch {
      put(document.getElementById('menu'), el('p', { class: 'alert', text: AT.t('err_network') }));
    }
  }
  document.addEventListener('langchange', () => site && render());
  load();
})();
