/* Gedeelde code voor website, bestellen en bestelstatus: taal, teksten, API, opmaak. */
(function () {
  'use strict';

  const STR = {
    nl: {
      nav_menu: 'Menukaart', nav_story: 'Over ons', nav_info: 'Openingstijden & route', nav_order: 'Bestellen',
      btn_menu: 'Bekijk de menukaart', btn_order: 'Bestel voor afhalen',
      demo_banner: '<strong>Demo</strong> – Aan Tafel en alle bedrijfsgegevens zijn fictief. Bestellingen gaan niet naar een echte zaak en betalingen zijn testbetalingen.',
      fictional_banner: 'Let op: deze bedrijfsgegevens zijn fictief.',
      back_home: '← Website',
      static_banner: '<strong>Etalageversie</strong> – Aan Tafel is fictief. Probeer gerust te bestellen: er wordt niets opgeslagen, verstuurd of betaald.',
      showcase_title: 'Voorbeeld van je bevestiging', showcase_pill: 'Voorbeeld',
      showcase_text: 'Dit is de etalageversie: deze bestelling is niet opgeslagen en niet naar de zaak gestuurd. In de volledige versie ontvangt de zaak hem direct in het beheer, krijgt de klant een e-mail en kun je ook online betalen.',
      menu_title: 'Menukaart', prices_note: 'Prijzen in euro, inclusief btw.', today_label: 'Vandaag', closed_today: 'vandaag gesloten', extra_label: 'Extra', menu_intro: 'Alles wat je hier ziet kun je ook online bestellen voor afhalen.',
      allergens_from_business: 'Allergeneninformatie zoals opgegeven door de zaak. Heb je een allergie? Vraag het ons altijd even.',
      contains: 'Bevat', no_allergen_info: 'Geen allergeneninformatie ingevuld – vraag het in de zaak.',
      sold_out: 'Uitverkocht', from: 'vanaf',
      story_gallery: 'Sfeerbeelden',
      hours: 'Openingstijden', location: 'Locatie & route', contact: 'Contact', closed: 'Gesloten',
      plan_route: 'Plan je route', closures: 'Extra gesloten',
      days: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'],
      footer_by: 'Website en bestelomgeving via', visit_title: 'Kom langs', kvk: 'KvK',
      order_title_both: 'Bestellen: afhalen of bezorgen', order_intro_both: 'Kies je gerechten, of je wilt afhalen of laten bezorgen, en reken af. Een account is niet nodig.',
      mode_question: 'Afhalen of bezorgen?', mode_pickup: 'Afhalen', mode_delivery: 'Bezorgen', mode_pickup_hint: 'Bij de zaak', mode_delivery_hint: 'Aan de deur',
      delivery_address: 'Bezorgadres', postcode: 'Postcode', house_number: 'Huisnummer', street: 'Straat', city: 'Plaats',
      delivery_date: 'Bezorgdag', delivery_time: 'Bezorgtijd', delivery_time_hint: 'Rond deze tijd bezorgen we je bestelling.',
      delivery_fee: 'Bezorgkosten', zone_checking: 'Postcode controleren…',
      zone_ok: (zone, fee, min) => `We bezorgen in ${zone}. Bezorgkosten ${fee}${min ? `, minimum bestelbedrag ${min}` : ''}.`,
      min_short: (amount) => `Nog ${amount} tot het minimum bestelbedrag voor bezorgen.`,
      delivery_in: 'Bezorgen in', pay_delivery: 'Betalen bij bezorging', pay_delivery_hint: 'Je betaalt aan de deur.',
      thanks_delivery: 'Je betaalt bij de bezorging.', delivery: 'Bezorgen', delivery_zones: 'Bezorgen', delivery_zones_intro: 'We bezorgen ook aan huis:',
      zone_line: (fee, min) => `bezorgkosten ${fee}, minimum ${min}`,
      st_out_for_delivery: 'Onderweg', st_delivered: 'Bezorgd', ps_pay_on_delivery: 'Betalen bij bezorging', ps_paid_on_delivery: 'Betaald bij bezorging',
      err_outside_delivery_area: 'We bezorgen helaas niet op deze postcode. Kies afhalen of controleer de postcode.',
      err_below_minimum: (min) => `Het minimum bestelbedrag voor bezorgen op dit adres is ${min}.`,
      err_invalid_address: 'Controleer het bezorgadres.', err_field_postcode: 'Vul een geldige postcode in (1234 AB).',
      err_field_houseNumber: 'Vul een huisnummer in.', err_field_street: 'Vul de straat in.', err_field_city: 'Vul de plaats in.',
      err_fulfillment_unavailable: 'Deze keuze (afhalen of bezorgen) is nu niet beschikbaar.',
      order_title: 'Bestellen voor afhalen', order_intro: 'Kies je gerechten, een afhaalmoment en reken af. Een account is niet nodig.',
      pickup_at: 'Afhalen bij', add: 'Toevoegen', add_to_order: 'Toevoegen aan bestelling', update_item: 'Wijziging opslaan',
      quantity: 'Aantal', item_note: 'Opmerking bij dit gerecht', item_note_ph: 'Bijv. zonder ui', optional: 'optioneel', required: 'verplicht',
      choose_max: (n) => `kies maximaal ${n}`, choose_one: 'kies één',
      your_order: 'Je bestelling', cart_empty: 'Je bestelling is nog leeg.', view_order: 'Bekijk bestelling',
      edit: 'Wijzigen', remove: 'Verwijderen', close: 'Sluiten', back: 'Terug',
      subtotal: 'Subtotaal', total: 'Totaal', incl_vat: 'Prijzen zijn inclusief btw.',
      to_checkout: 'Verder naar afrekenen', checkout: 'Afrekenen', step_cart: '1. Gerechten', step_details: '2. Gegevens', step_pay: '3. Betalen',
      pickup_date: 'Afhaaldag', pickup_time: 'Afhaaltijd', choose_date: 'Kies een dag', no_slots: 'Geen afhaaltijden beschikbaar op deze dag.',
      full: 'vol', loading: 'Laden…',
      reason_closed_day: 'gesloten', reason_closure: 'gesloten', reason_no_more_today: 'geen tijden meer', reason_full: 'vol',
      today: 'Vandaag', tomorrow: 'Morgen',
      your_details: 'Je gegevens', name: 'Naam', email: 'E-mailadres', phone: 'Telefoonnummer',
      email_hint: 'Voor je bevestiging.', phone_hint: 'Alleen als we je moeten bereiken over je bestelling.',
      order_note: 'Opmerking voor de zaak', payment: 'Betalen', pay_online: 'Online betalen', pay_online_hint: 'Via de beveiligde betaalpagina van onze betaalprovider.',
      pay_online_test: 'Testbetaling – er wordt geen echt geld afgeschreven.',
      pay_pickup: 'Betalen bij afhalen', pay_pickup_hint: 'Je betaalt in de zaak.',
      privacy_note: 'We gebruiken je gegevens alleen om deze bestelling te verwerken.',
      place_order: 'Bestelling plaatsen', place_and_pay: 'Bestellen en betalen', placing: 'Bezig…',
      ordering_paused: 'Online bestellen is tijdelijk gepauzeerd.',
      // status
      order_number: 'Bestelnummer', status: 'Status', pickup: 'Afhalen', at: 'om', payment_label: 'Betaling', address: 'Adres',
      st_received: 'Ontvangen', st_preparing: 'In voorbereiding', st_ready: 'Klaar om af te halen', st_picked_up: 'Afgehaald', st_cancelled: 'Geannuleerd', st_pending_payment: 'Wacht op betaling',
      ps_paid: 'Online betaald', ps_pay_at_pickup: 'Betalen bij afhalen', ps_paid_at_pickup: 'Betaald bij afhalen', ps_open: 'Betaling nog niet bevestigd', ps_not_started: 'Betaling niet gestart',
      ps_failed: 'Betaling mislukt', ps_canceled: 'Betaling geannuleerd', ps_expired: 'Betaling verlopen',
      thanks_title: 'Bedankt! Je bestelling is ontvangen.',
      thanks_paid: 'Je betaling is bevestigd door de betaalprovider.',
      thanks_pickup: 'Je betaalt bij het afhalen.',
      waiting_title: 'We wachten op de bevestiging van je betaling',
      waiting_text: 'Dit duurt meestal maar even. Je bestelling is pas definitief als de betaalprovider de betaling heeft bevestigd.',
      failed_title: 'De betaling is niet gelukt',
      failed_text: 'Er is niets afgeschreven en je bestelling is nog niet definitief. Je kunt het opnieuw proberen.',
      canceled_title: 'Je hebt de betaling geannuleerd',
      start_failed_title: 'De betaling kon niet worden gestart',
      start_failed_text: 'Je bestelling is opgeslagen maar nog niet betaald en dus nog niet definitief. Probeer het opnieuw.',
      retry_payment: 'Opnieuw proberen te betalen', continue_payment: 'Verder naar betalen',
      expired_title: 'Deze bestelling is niet geplaatst',
      expired_text: 'De betaling is niet (op tijd) afgerond, daarom is het afhaalmoment vrijgegeven. Plaats gerust een nieuwe bestelling.',
      cancelled_title: 'Deze bestelling is geannuleerd',
      cancelled_text: 'Neem contact op met de zaak als je vragen hebt.',
      hold_until: 'Je afhaalmoment is gereserveerd tot',
      confirmation_sent: 'Een bevestiging gaat naar',
      demo_no_mail: 'In de demo worden geen e-mails verstuurd.',
      new_order: 'Nieuwe bestelling', to_home: 'Naar de website',
      load_failed: 'We konden je bestelling niet ophalen. Controleer je internetverbinding en probeer het opnieuw. Zie je dit vaker, neem dan contact op met de zaak.',
      retry: 'Opnieuw proberen',
      // fouten
      err_generic: 'Er ging iets mis. Je bestelling is niet geplaatst. Probeer het opnieuw.',
      err_network: 'Geen verbinding met de server. Je bestelling is niet geplaatst. Controleer je internet en probeer het opnieuw.',
      err_cart_invalid: 'Een of meer gerechten zijn niet meer beschikbaar of gewijzigd. Pas je bestelling aan.',
      err_sold_out: 'is uitverkocht', err_product_unavailable: 'is niet meer beschikbaar', err_option_sold_out: 'een keuze is uitverkocht',
      err_option_required: 'maak een keuze', err_invalid_options: 'keuzes zijn gewijzigd, kies opnieuw', err_invalid_quantity: 'ongeldig aantal',
      err_too_many_items: (n) => `Je kunt maximaal ${n} gerechten per bestelling bestellen.`,
      err_cart_empty: 'Je bestelling is leeg.',
      err_slot_full: 'Dit afhaalmoment is net volgeboekt. Kies een ander tijdstip.',
      err_pickup_date_unavailable: 'Op deze dag kun je niet afhalen. Kies een andere dag.',
      err_pickup_time_unavailable: 'Deze afhaaltijd is niet (meer) beschikbaar. Kies een ander tijdstip.',
      err_invalid_pickup: 'Kies een afhaaldag en -tijd.',
      err_ordering_paused: 'Online bestellen is op dit moment gepauzeerd.',
      err_payment_method_unavailable: 'Deze betaalmethode is nu niet beschikbaar. Kies een andere.',
      err_invalid_customer: 'Controleer je gegevens.',
      err_field_name: 'Vul je naam in.', err_field_email: 'Vul een geldig e-mailadres in.', err_field_phone: 'Vul een geldig telefoonnummer in.',
      err_rate_limited: 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.',
      err_order_expired: 'De reservering van je afhaalmoment is verlopen. Plaats een nieuwe bestelling.',
      err_payment_start_failed: 'De betaalprovider is nu niet bereikbaar.',
      err_payment_unavailable: 'Online betalen is nu niet beschikbaar.',
      err_idempotency_conflict: 'Je bestelling is gewijzigd tijdens het verzenden. Probeer het opnieuw.',
      err_too_many_payment_attempts: 'Te veel betaalpogingen voor deze bestelling. Neem contact op met de zaak.',
      allergen: {
        gluten: 'gluten', crustaceans: 'schaaldieren', eggs: 'ei', fish: 'vis', peanuts: 'pinda', soy: 'soja', milk: 'melk',
        nuts: 'noten', celery: 'selderij', mustard: 'mosterd', sesame: 'sesam', sulphites: 'sulfiet', lupin: 'lupine', molluscs: 'weekdieren',
      },
      diet: { vegetarian: 'vegetarisch', vegan: 'veganistisch' },
    },
    en: {
      nav_menu: 'Menu', nav_story: 'About', nav_info: 'Hours & directions', nav_order: 'Order',
      btn_menu: 'View the menu', btn_order: 'Order for pickup',
      demo_banner: '<strong>Demo</strong> – Aan Tafel and all business details are fictional. Orders are not sent to a real business and payments are test payments.',
      fictional_banner: 'Note: these business details are fictional.',
      back_home: '← Website',
      static_banner: '<strong>Showcase version</strong> – Aan Tafel is fictional. Feel free to try ordering: nothing is saved, sent or paid.',
      showcase_title: 'Example of your confirmation', showcase_pill: 'Example',
      showcase_text: 'This is the showcase version: this order has not been saved or sent to the business. In the full version the business receives it right away in the admin, the customer gets an email and online payment is available too.',
      menu_title: 'Menu', prices_note: 'Prices in euros, including VAT.', today_label: 'Today', closed_today: 'closed today', extra_label: 'Extra', menu_intro: 'Everything you see here can also be ordered online for pickup.',
      allergens_from_business: 'Allergen information as provided by the business. Have an allergy? Please always check with us.',
      contains: 'Contains', no_allergen_info: 'No allergen information provided – please ask in store.',
      sold_out: 'Sold out', from: 'from',
      story_gallery: 'Impressions',
      hours: 'Opening hours', location: 'Location & directions', contact: 'Contact', closed: 'Closed',
      plan_route: 'Get directions', closures: 'Additional closures',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      footer_by: 'Website and ordering by', visit_title: 'Visit us', kvk: 'Chamber of Commerce',
      order_title_both: 'Order: pickup or delivery', order_intro_both: 'Choose your dishes, pickup or delivery, and check out. No account needed.',
      mode_question: 'Pickup or delivery?', mode_pickup: 'Pickup', mode_delivery: 'Delivery', mode_pickup_hint: 'At the shop', mode_delivery_hint: 'To your door',
      delivery_address: 'Delivery address', postcode: 'Postcode', house_number: 'House number', street: 'Street', city: 'City',
      delivery_date: 'Delivery day', delivery_time: 'Delivery time', delivery_time_hint: 'We deliver your order around this time.',
      delivery_fee: 'Delivery fee', zone_checking: 'Checking postcode…',
      zone_ok: (zone, fee, min) => `We deliver to ${zone}. Delivery fee ${fee}${min ? `, minimum order ${min}` : ''}.`,
      min_short: (amount) => `${amount} more to reach the minimum order for delivery.`,
      delivery_in: 'Delivery to', pay_delivery: 'Pay on delivery', pay_delivery_hint: 'You pay at the door.',
      thanks_delivery: 'You pay on delivery.', delivery: 'Delivery', delivery_zones: 'Delivery', delivery_zones_intro: 'We also deliver to your door:',
      zone_line: (fee, min) => `delivery fee ${fee}, minimum ${min}`,
      st_out_for_delivery: 'Out for delivery', st_delivered: 'Delivered', ps_pay_on_delivery: 'Pay on delivery', ps_paid_on_delivery: 'Paid on delivery',
      err_outside_delivery_area: 'Unfortunately we do not deliver to this postcode. Choose pickup or check the postcode.',
      err_below_minimum: (min) => `The minimum order for delivery to this address is ${min}.`,
      err_invalid_address: 'Please check the delivery address.', err_field_postcode: 'Please enter a valid postcode (1234 AB).',
      err_field_houseNumber: 'Please enter a house number.', err_field_street: 'Please enter the street.', err_field_city: 'Please enter the city.',
      err_fulfillment_unavailable: 'This option (pickup or delivery) is not available right now.',
      order_title: 'Order for pickup', order_intro: 'Choose your dishes, a pickup time and check out. No account needed.',
      pickup_at: 'Pick up at', add: 'Add', add_to_order: 'Add to order', update_item: 'Save changes',
      quantity: 'Quantity', item_note: 'Note for this dish', item_note_ph: 'E.g. no onion', optional: 'optional', required: 'required',
      choose_max: (n) => `choose up to ${n}`, choose_one: 'choose one',
      your_order: 'Your order', cart_empty: 'Your order is still empty.', view_order: 'View order',
      edit: 'Edit', remove: 'Remove', close: 'Close', back: 'Back',
      subtotal: 'Subtotal', total: 'Total', incl_vat: 'Prices include VAT.',
      to_checkout: 'Continue to checkout', checkout: 'Checkout', step_cart: '1. Dishes', step_details: '2. Details', step_pay: '3. Payment',
      pickup_date: 'Pickup day', pickup_time: 'Pickup time', choose_date: 'Choose a day', no_slots: 'No pickup times available on this day.',
      full: 'full', loading: 'Loading…',
      reason_closed_day: 'closed', reason_closure: 'closed', reason_no_more_today: 'no times left', reason_full: 'full',
      today: 'Today', tomorrow: 'Tomorrow',
      your_details: 'Your details', name: 'Name', email: 'Email address', phone: 'Phone number',
      email_hint: 'For your confirmation.', phone_hint: 'Only if we need to reach you about your order.',
      order_note: 'Note for the business', payment: 'Payment', pay_online: 'Pay online', pay_online_hint: 'On the secure payment page of our payment provider.',
      pay_online_test: 'Test payment – no real money will be charged.',
      pay_pickup: 'Pay at pickup', pay_pickup_hint: 'You pay in store.',
      privacy_note: 'We only use your details to process this order.',
      place_order: 'Place order', place_and_pay: 'Order and pay', placing: 'Working…',
      ordering_paused: 'Online ordering is temporarily paused.',
      order_number: 'Order number', status: 'Status', pickup: 'Pickup', at: 'at', payment_label: 'Payment', address: 'Address',
      st_received: 'Received', st_preparing: 'Being prepared', st_ready: 'Ready for pickup', st_picked_up: 'Picked up', st_cancelled: 'Cancelled', st_pending_payment: 'Awaiting payment',
      ps_paid: 'Paid online', ps_pay_at_pickup: 'Pay at pickup', ps_paid_at_pickup: 'Paid at pickup', ps_open: 'Payment not yet confirmed', ps_not_started: 'Payment not started',
      ps_failed: 'Payment failed', ps_canceled: 'Payment cancelled', ps_expired: 'Payment expired',
      thanks_title: 'Thank you! Your order has been received.',
      thanks_paid: 'Your payment has been confirmed by the payment provider.',
      thanks_pickup: 'You pay when you pick up.',
      waiting_title: 'Waiting for your payment to be confirmed',
      waiting_text: 'This usually only takes a moment. Your order is final once the payment provider has confirmed the payment.',
      failed_title: 'The payment did not go through',
      failed_text: 'Nothing has been charged and your order is not final yet. You can try again.',
      canceled_title: 'You cancelled the payment',
      start_failed_title: 'The payment could not be started',
      start_failed_text: 'Your order has been saved but not paid, so it is not final yet. Please try again.',
      retry_payment: 'Try paying again', continue_payment: 'Continue to payment',
      expired_title: 'This order was not placed',
      expired_text: 'The payment was not completed (in time), so the pickup time has been released. Feel free to place a new order.',
      cancelled_title: 'This order has been cancelled',
      cancelled_text: 'Please contact the business if you have any questions.',
      hold_until: 'Your pickup time is reserved until',
      confirmation_sent: 'A confirmation is sent to',
      demo_no_mail: 'No emails are sent in the demo.',
      new_order: 'New order', to_home: 'Back to the website',
      load_failed: 'We could not load your order. Check your internet connection and try again. If this keeps happening, please contact the business.',
      retry: 'Try again',
      err_generic: 'Something went wrong. Your order has not been placed. Please try again.',
      err_network: 'No connection to the server. Your order has not been placed. Check your internet and try again.',
      err_cart_invalid: 'One or more dishes are no longer available or have changed. Please update your order.',
      err_sold_out: 'is sold out', err_product_unavailable: 'is no longer available', err_option_sold_out: 'a choice is sold out',
      err_option_required: 'please make a choice', err_invalid_options: 'choices have changed, please choose again', err_invalid_quantity: 'invalid quantity',
      err_too_many_items: (n) => `You can order up to ${n} items per order.`,
      err_cart_empty: 'Your order is empty.',
      err_slot_full: 'This pickup time has just filled up. Please choose another time.',
      err_pickup_date_unavailable: 'Pickup is not possible on this day. Please choose another day.',
      err_pickup_time_unavailable: 'This pickup time is no longer available. Please choose another time.',
      err_invalid_pickup: 'Please choose a pickup day and time.',
      err_ordering_paused: 'Online ordering is currently paused.',
      err_payment_method_unavailable: 'This payment method is not available right now. Please choose another.',
      err_invalid_customer: 'Please check your details.',
      err_field_name: 'Please enter your name.', err_field_email: 'Please enter a valid email address.', err_field_phone: 'Please enter a valid phone number.',
      err_rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
      err_order_expired: 'The reservation of your pickup time has expired. Please place a new order.',
      err_payment_start_failed: 'The payment provider cannot be reached right now.',
      err_payment_unavailable: 'Online payment is not available right now.',
      err_idempotency_conflict: 'Your order changed while sending. Please try again.',
      err_too_many_payment_attempts: 'Too many payment attempts for this order. Please contact the business.',
      allergen: {
        gluten: 'gluten', crustaceans: 'crustaceans', eggs: 'egg', fish: 'fish', peanuts: 'peanuts', soy: 'soy', milk: 'milk',
        nuts: 'tree nuts', celery: 'celery', mustard: 'mustard', sesame: 'sesame', sulphites: 'sulphites', lupin: 'lupin', molluscs: 'molluscs',
      },
      diet: { vegetarian: 'vegetarian', vegan: 'vegan' },
    },
  };

  // Taal: ?lang= in de URL gaat voor, dan de opgeslagen keuze, dan de browser.
  function detectLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'nl' || q === 'en') { store('at_lang', q); return q; }
    const saved = read('at_lang');
    if (saved === 'nl' || saved === 'en') return saved;
    return (navigator.language || 'nl').toLowerCase().startsWith('nl') ? 'nl' : (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'nl';
  }
  function read(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch { /* opslag niet beschikbaar */ } }

  const AT = {
    lang: detectLang(),
    t(key, ...args) {
      const v = STR[AT.lang][key] ?? STR.nl[key] ?? key;
      return typeof v === 'function' ? v(...args) : v;
    },
    pick(obj) { if (!obj) return ''; return (AT.lang === 'en' && obj.en) ? obj.en : (obj.nl || ''); },
    setLang(l) {
      AT.lang = l;
      store('at_lang', l);
      const u = new URL(location.href);
      u.searchParams.set('lang', l);
      history.replaceState(null, '', u);
      document.documentElement.lang = l;
      document.dispatchEvent(new CustomEvent('langchange'));
    },
    // Op GitHub Pages staat de site in een submap (/repo-naam/); elders is base leeg.
    base: location.hostname.endsWith('github.io') ? '/' + location.pathname.split('/')[1] : '',
    link(path) {
      const u = new URL(path, location.origin);
      u.searchParams.set('lang', AT.lang);
      return AT.base + u.pathname + u.search + u.hash;
    },
    money(c) {
      return new Intl.NumberFormat(AT.lang === 'en' ? 'en-IE' : 'nl-NL', { style: 'currency', currency: 'EUR' }).format((c || 0) / 100);
    },
    dateLong(d) {
      const [y, m, dd] = d.split('-').map(Number);
      return new Intl.DateTimeFormat(AT.lang === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m - 1, dd)));
    },
    dateShort(d) {
      const [y, m, dd] = d.split('-').map(Number);
      return new Intl.DateTimeFormat(AT.lang === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m - 1, dd)));
    },
    time(iso) {
      return new Intl.DateTimeFormat(AT.lang === 'en' ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso));
    },
    // Kleine helper om veilig DOM te bouwen (geen innerHTML met gebruikersinvoer).
    el(tag, attrs, ...children) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (v === false || v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
      for (const c of children.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
      return e;
    },
    async api(path, opts = {}) {
      let res;
      try {
        // Zonder server komen site- en menugegevens uit de vaste JSON-bestanden.
        const file = { '/api/site': '/data/site.json', '/api/catalog': '/data/catalog.json' }[path];
        res = await fetch(AT.base + (file || path), {
          method: opts.method || 'GET',
          headers: opts.body ? { 'Content-Type': 'application/json' } : {},
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          credentials: 'same-origin',
        });
      } catch {
        const e = new Error('network'); e.code = 'network'; throw e;
      }
      let data = null;
      try { data = await res.json(); } catch { /* geen json */ }
      if (!res.ok) {
        const e = new Error(data?.error?.code || 'generic');
        e.code = data?.error?.code || 'generic';
        e.details = data?.error?.details;
        e.status = res.status;
        throw e;
      }
      if (!data) { const e = new Error('generic'); e.code = 'generic'; throw e; }
      return data;
    },
    errorText(code) {
      const k = 'err_' + code;
      return STR[AT.lang][k] ? AT.t(k) : AT.t('err_generic');
    },
    allergenText(p) {
      const list = (p.allergens || []).map((a) => STR[AT.lang].allergen[a] || a);
      const note = AT.pick(p.allergen_note);
      if (!list.length && !note) return AT.t('no_allergen_info');
      return [list.length ? `${AT.t('contains')}: ${list.join(', ')}.` : '', note].filter(Boolean).join(' ');
    },
    dietTags(p) {
      return (p.diets || []).map((d) => AT.el('span', { class: 'tag tag-diet', text: STR[AT.lang].diet[d] || d }));
    },
    // Zoals replaceChildren, maar slaat lege waarden (null/false) over.
    put(node, ...kids) { node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false)); },
    store, read,
  };

  // Kop, taalschakelaar, demo-melding en voettekst.
  AT.renderChrome = function (site, { active } = {}) {
    document.documentElement.lang = AT.lang;
    const banner = document.getElementById('demo-banner');
    if (banner) {
      banner.hidden = !(site.demo || site.business.is_fictional);
      banner.innerHTML = site.static ? STR[AT.lang].static_banner : site.demo ? STR[AT.lang].demo_banner : STR[AT.lang].fictional_banner; // vaste, eigen tekst
    }
    document.querySelectorAll('[data-brand]').forEach((b) => {
      b.textContent = site.business.name;
      const tag = AT.pick(site.business.tagline);
      if (tag) b.append(AT.el('small', { text: tag }));
      b.setAttribute('href', AT.link('/'));
    });
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = AT.t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-label]').forEach((n) => { n.setAttribute('aria-label', AT.t(n.dataset.i18nLabel)); });
    document.querySelectorAll('[data-href]').forEach((n) => { n.setAttribute('href', AT.link(n.dataset.href)); });
    document.querySelectorAll('.lang-switch button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === AT.lang));
      b.onclick = () => AT.setLang(b.dataset.lang);
    });
    const foot = document.getElementById('footer');
    if (foot) {
      const b = site.business;
      const tag = AT.pick(b.tagline);
      foot.replaceChildren(AT.el('div', { class: 'wrap' },
        AT.el('span', { class: 'footer-brand' }, b.name, tag ? AT.el('small', { text: tag }) : null),
        AT.el('span', { class: 'footer-line' }, [b.street, `${b.postal_code} ${b.city}`.trim()].filter(Boolean).join(' · ')),
        AT.el('span', {}, `© ${new Date().getFullYear()} ${b.name}`, b.kvk ? ` · ${AT.t('kvk')} ${b.kvk}` : '',
          ` · ${AT.t('footer_by')} `, AT.el('a', { href: site.onlinedesk_url, rel: 'noopener', target: '_blank', text: 'OnlineDesk' })),
      ));
    }
    if (active) document.querySelectorAll('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === active));
  };

  window.AT = AT;
})();
