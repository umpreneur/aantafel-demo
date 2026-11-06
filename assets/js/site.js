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
    renderReservation();
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


  // Interactive reservation demo: all state stays in this page's memory.
  const reservation = { month: null, date: '', time: '', guests: '2', name: '', email: '', note: '', step: 1 };
  const reservationToday = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const reservationDay = value => new Date(value + 'T12:00:00Z');
  function reservationTimes(value) {
    const day = reservationDay(value);
    const ranges = site.opening_hours[String(day.getUTCDay())] || [];
    const today = reservationToday();
    const nowParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
    const now = nowParts.hour * 60 + nowParts.minute;
    const options = [];
    ranges.forEach(range => {
      const minutes = str => { const [h,m] = str.split(':').map(Number); return h*60+m; };
      for(let m=minutes(range.from); m<=minutes(range.to)-60; m+=30) {
        if(value===today && m<now+60) continue;
        const label = String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        options.push({ label, full: (day.getUTCDate()+Math.floor(m/30))%5===0 });
      }
    });
    return options;
  }
  function reservationOpen(value) {
    if(value < reservationToday()) return false;
    const closure = (site.closures || []).some(c=>value>=c.date_from && value<=c.date_to);
    return !closure && reservationTimes(value).some(t=>!t.full);
  }
  function renderReservation(focus=false) {
    const root = document.getElementById('reservation-app');
    if(!root || !site) return;
    const en = AT.lang==='en';
    const say = (nl,eng) => en ? eng : nl;
    const title = document.getElementById('reservation-title');
    title.textContent = say('Een plekje aan tafel.','A place at the table.');
    document.querySelectorAll('[data-reserve-link]').forEach(a=>a.textContent=say('Reserveer een tafel','Reserve a table'));
    document.getElementById('reservation-intro').textContent = say('Kies een moment en ervaar hoe eenvoudig reserveren kan zijn.','Choose a moment and try how easy reserving a table can be.');
    const demo = el('p',{class:'reservation-demo'},say('Demoagenda: beschikbaarheid is fictief. Er wordt niets opgeslagen of verstuurd.','Demo calendar: availability is fictional. Nothing is saved or sent.'));
    const progress = el('ol',{class:'reservation-progress','aria-label':say('Reserveringsstappen','Reservation steps')},
      ...[say('Moment','Visit'),say('Gegevens','Details'),say('Controleren','Review')].map((label,i)=>el('li',{'aria-current':reservation.step===i+1?'step':null,class:reservation.step>=i+1?'is-active':''},el('span',{},String(i+1)),label)));
    const move = step => { reservation.step=step;renderReservation(true); };
    const button = (label,action,primary=false) => el('button',{type:'button',class:'btn'+(primary?' btn-primary':''),onclick:action},label);
    const fmt = value => AT.dateLong(value);
    const summary = () => el('dl',{class:'reservation-summary'},
      el('div',{},el('dt',{},say('Wanneer','When')),el('dd',{},fmt(reservation.date)+' · '+reservation.time)),
      el('div',{},el('dt',{},say('Gezelschap','Party')),el('dd',{},reservation.guests+' '+say('personen','guests'))));
    let panel;
    if(reservation.step===1) {
      if(!reservation.month) reservation.month=reservationToday().slice(0,7);
      const month = new Date(reservation.month+'-01T12:00:00Z');
      const todayMonth=reservationToday().slice(0,7);
      const nextMonth = delta => { const d = new Date(month);d.setUTCMonth(d.getUTCMonth()+delta);reservation.month=d.toISOString().slice(0,7);renderReservation(true); };
      const monthName = new Intl.DateTimeFormat(en?'en-GB':'nl-NL',{month:'long',year:'numeric',timeZone:'UTC'}).format(month);
      const prev=button('‹',()=>nextMonth(-1));prev.setAttribute('aria-label',say('Vorige maand','Previous month'));prev.disabled=reservation.month<=todayMonth;
      const next=button('›',()=>nextMonth(1));next.setAttribute('aria-label',say('Volgende maand','Next month'));
      const maxMonth=new Date(reservationToday()+'T12:00:00Z');maxMonth.setUTCMonth(maxMonth.getUTCMonth()+3);next.disabled=reservation.month>=maxMonth.toISOString().slice(0,7);
      const grid=el('div',{class:'reservation-calendar','aria-label':monthName});
      const days=en?['Mo','Tu','We','Th','Fr','Sa','Su']:['Ma','Di','Wo','Do','Vr','Za','Zo'];
      days.forEach(day=>grid.append(el('span',{class:'reservation-weekday','aria-hidden':'true'},day)));
      const offset=(month.getUTCDay()+6)%7;
      for(let n=0;n<offset;n++) grid.append(el('span',{'aria-hidden':'true'}));
      const count=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
      for(let day=1;day<=count;day++) {
        const value=reservation.month+'-'+String(day).padStart(2,'0');
        const open=reservationOpen(value);
        const label=fmt(value)+(open?'':say(' — gesloten of niet beschikbaar',' — closed or unavailable'));
        grid.append(el('button',{type:'button',class:'reservation-day'+(reservation.date===value?' is-selected':''),'aria-label':label,'aria-pressed':String(reservation.date===value),disabled:!open,onclick:()=>{reservation.date=value;reservation.time='';renderReservation();}},String(day)));
      }
      const guests=el('select',{id:'reservation-guests',onchange:e=>{reservation.guests=e.target.value;}},...[1,2,3,4,5,6].map(n=>el('option',{value:String(n),selected:String(n)===reservation.guests},n+' '+say(n===1?'persoon':'personen',n===1?'guest':'guests'))));
      const times=el('div',{class:'reservation-times'});
      if(reservation.date) {
        times.append(el('p',{class:'reservation-date-label'},fmt(reservation.date)));
        reservationTimes(reservation.date).forEach(slot=>times.append(el('button',{type:'button',class:'reservation-time'+(reservation.time===slot.label?' is-selected':''),disabled:slot.full,'aria-pressed':String(reservation.time===slot.label),'aria-label':slot.label+(slot.full?say(' — vol',' — fully booked'):''),onclick:()=>{reservation.time=slot.label;renderReservation();}},slot.label,slot.full?el('small',{},say('Vol','Full')):null)));
      } else times.append(el('p',{class:'muted'},say('Kies eerst een beschikbare dag.','Choose an available day first.')));
      const proceed=button(say('Verder naar je gegevens','Continue to your details'),()=>move(2),true);proceed.disabled=!reservation.date||!reservation.time;
      panel=el('div',{class:'reservation-columns'},
        el('div',{class:'reservation-calendar-panel'},el('div',{class:'reservation-month'},prev,el('h3',{tabindex:'-1',id:'reservation-step-title'},monthName),next),grid,el('p',{class:'small muted'},say('Grijze dagen zijn gesloten of niet beschikbaar.','Grey dates are closed or unavailable.'))),
        el('div',{class:'reservation-options'},el('label',{for:'reservation-guests'},say('Met hoeveel personen?','How many guests?')),guests,el('h3',{},say('Kies een tijd','Choose a time')),times,el('p',{class:'small muted'},say('Voorbeeld: een tafel voor maximaal 6 personen, met ongeveer een uur aan tafel.','Example: a table for up to 6 guests, with about an hour at the table.')),proceed));
    } else if(reservation.step===2) {
      const field=(id,label,type,value)=>el('label',{class:'reservation-field',for:id},el('span',{},label),el(type==='textarea'?'textarea':'input',{id,name:id,type:type==='textarea'?null:type,value:type==='textarea'?null:value,required:type!=='textarea',maxlength:type==='textarea'?'500':'150',autocomplete:type==='email'?'email':type==='text'?'name':null,oninput:e=>{reservation[id.replace('reservation-','')]=e.target.value;}},type==='textarea'?value:null));
      const form=el('form',{class:'reservation-details',onsubmit:e=>{
        e.preventDefault();
        if(!form.reportValidity()) return;
        const email=form.querySelector('[type=email]');
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reservation.email)){email.setCustomValidity(say('Vul een geldig e-mailadres in.','Enter a valid email address.'));email.reportValidity();return;}
        if(!reservation.name.trim()){const name=form.querySelector('[name=reservation-name]');name.setCustomValidity(say('Vul je naam in.','Enter your name.'));name.reportValidity();return;}
        move(3);
      }},
        el('h3',{tabindex:'-1',id:'reservation-step-title'},say('Op welke naam?','Whose name is it under?')),summary(),
        field('reservation-name',say('Naam','Name'),'text',reservation.name),
        field('reservation-email',say('E-mailadres','Email address'),'email',reservation.email),
        field('reservation-note',say('Opmerking (optioneel)','Note (optional)'),'textarea',reservation.note),
        el('p',{class:'small muted'},say('Gebruik fictieve gegevens om de demo te testen.','Use fictional details to try the demo.')),
        el('div',{class:'reservation-actions'},button(say('Terug','Back'),()=>move(1)),el('button',{type:'submit',class:'btn btn-primary'},say('Controleer je reservering','Review your reservation'))));
      form.addEventListener('input',e=>e.target.setCustomValidity?.(''));
      panel=form;
    } else if(reservation.step===3) {
      panel=el('div',{class:'reservation-review'},el('h3',{tabindex:'-1',id:'reservation-step-title'},say('Klopt alles?','Does everything look right?')),summary(),
        el('dl',{class:'reservation-summary'},
          el('div',{},el('dt',{},say('Naam','Name')),el('dd',{},reservation.name)),
          el('div',{},el('dt',{},say('E-mail','Email')),el('dd',{},reservation.email)),
          reservation.note?el('div',{},el('dt',{},say('Opmerking','Note')),el('dd',{},reservation.note)):null),
        el('p',{class:'reservation-demo'},say('Dit is alleen een demonstratie. Je reserveert geen echte tafel.','This is a demonstration only. You are not reserving a real table.')),
        el('div',{class:'reservation-actions'},button(say('Gegevens wijzigen','Edit details'),()=>move(2)),button(say('Reservering uitproberen','Try the reservation'),()=>move(4),true)));
    } else {
      panel=el('div',{class:'reservation-success',role:'status'},
        el('span',{class:'reservation-check','aria-hidden':'true'},'✓'),
        el('h3',{tabindex:'-1',id:'reservation-step-title'},say('Zo werkt reserveren.','That is how reserving works.')),
        el('p',{},say('Dit was een demo. Er is geen reservering gemaakt. Je gegevens zijn niet opgeslagen of verstuurd.','This was a demo. No reservation was made. Your details were not saved or sent.')),
        summary(),button(say('Opnieuw proberen','Try again'),()=>{Object.assign(reservation,{date:'',time:'',name:'',email:'',note:'',step:1});renderReservation(true);}));
    }
    put(root,demo,reservation.step<4?progress:null,panel);
    if(focus) {
      root.scrollIntoView({behavior:'instant',block:'start'});
      document.getElementById('reservation-step-title')?.focus({preventScroll:true});
    }
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
