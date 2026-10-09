/* Prise de rendez-vous Calendly.
   - Accueil : calendrier intégré dans la section contact (chargé à l'approche).
   - Autres liens Calendly : le calendrier s'ouvre par-dessus la page.
   - rdv_calendly n'est envoyé qu'à la confirmation d'une réservation
     (message calendly.event_scheduled), une seule fois par invité.
   - La source de la visite (utm_*, gclid) est transmise à Calendly. */
(function () {
  var ORIGIN = 'https://calendly.com';
  var SELECTOR = 'a[href*="calendly.com/partenariat-idcap"]';
  var SRC_KEY = 'adp_source';
  var SENT_KEY = 'adp_rdv';
  var SRC_MAX_AGE = 90 * 24 * 3600 * 1000;
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid'];
  var ADS_CONVERSION = 'AW-18294420606/P1oXCKSH0sscEP7oupNE';

  function granted() {
    return !!(window.adpConsent && window.adpConsent.granted());
  }

  /* --- Source de la visite --- */
  function fromUrl() {
    var q = new URLSearchParams(location.search), src = {}, found = false;
    FIELDS.forEach(function (k) {
      var v = q.get(k);
      if (v) { src[k] = v.slice(0, 200); found = true; }
    });
    return found ? src : null;
  }

  function loadStored() {
    try {
      var c = JSON.parse(localStorage.getItem(SRC_KEY));
      if (c && c.s && Date.now() - c.t < SRC_MAX_AGE) return c.s;
    } catch (e) {}
    return null;
  }

  function store(src) {
    try { localStorage.setItem(SRC_KEY, JSON.stringify({ s: src, t: Date.now() })); } catch (e) {}
  }

  /* Une nouvelle arrivée avec des paramètres remplace la précédente.
     Rien n'est conservé ni transmis comme gclid sans accord aux cookies. */
  var landing = fromUrl();
  if (landing && granted()) store(landing);
  document.addEventListener('adp:consent-granted', function () { if (landing) store(landing); });

  function utmParams() {
    var src = landing || (granted() ? loadStored() : null);
    if (!src) return {};
    var out = {};
    var hasUtm = FIELDS.some(function (k) { return k !== 'gclid' && src[k]; });
    if (hasUtm) {
      FIELDS.forEach(function (k) { if (k !== 'gclid' && src[k]) out[k] = src[k]; });
    } else if (src.gclid) {
      out.utm_source = 'google';
      out.utm_medium = 'cpc';
      if (granted()) out.utm_term = src.gclid;
    }
    return out;
  }

  function withSource(href) {
    var u;
    try { u = new URL(href, location.href); } catch (e) { return href; }
    var p = utmParams();
    Object.keys(p).forEach(function (k) { u.searchParams.set(k, p[k]); });
    return u.toString();
  }

  /* --- Chargement du widget Calendly --- */
  var waiting = null;
  function loadWidget(cb) {
    if (window.Calendly) { if (cb) cb(); return; }
    if (!waiting) {
      waiting = [];
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://assets.calendly.com/assets/external/widget.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.onload = function () { waiting.forEach(function (f) { f(); }); waiting = []; };
      document.head.appendChild(s);
    }
    if (cb) waiting.push(cb);
  }

  /* Liens : la source est ajoutée à l'adresse ; si le widget est prêt, le
     calendrier s'ouvre sur la page, sinon dans un nouvel onglet comme avant. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!a) return;
    a.href = withSource(a.href);
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0 || !window.Calendly) return;
    e.preventDefault();
    window.Calendly.initPopupWidget({ url: a.href });
  });

  ['pointerover', 'touchstart', 'focusin'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.target.closest && e.target.closest(SELECTOR)) loadWidget();
    }, { passive: true });
  });

  /* --- Calendrier intégré (accueil) --- */
  function initInline() {
    var box = document.getElementById('calendly-inline');
    if (!box) return;
    var start = function () {
      loadWidget(function () {
        window.Calendly.initInlineWidget({
          url: withSource(box.getAttribute('data-url')),
          parentElement: box
        });
        box.hidden = false;
        var fb = document.querySelector('.calendly-fallback');
        if (fb) fb.style.display = 'none';
      });
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); start(); }
      }, { rootMargin: '600px 0px' });
      io.observe(box.parentNode);
    } else {
      start();
    }
  }

  /* --- Réservation confirmée --- */
  var sent = {};
  function alreadySent(uri) {
    if (sent[uri]) return true;
    try { return (JSON.parse(localStorage.getItem(SENT_KEY)) || []).indexOf(uri) !== -1; } catch (e) { return false; }
  }
  function markSent(uri) {
    sent[uri] = true;
    if (!granted()) return;
    try {
      var list = JSON.parse(localStorage.getItem(SENT_KEY)) || [];
      list.push(uri);
      localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-20)));
    } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN) return;
    var d = e.data;
    if (!d || d.event !== 'calendly.event_scheduled') return;
    var uri = d.payload && d.payload.invitee && d.payload.invitee.uri;
    if (!uri || alreadySent(uri)) return;
    markSent(uri);
    if (typeof window.adpTrack !== 'function') return;
    window.adpTrack('rdv_calendly', {
      event_category: 'engagement',
      event_label: 'reservation_confirmee',
      value: 500,
      currency: 'EUR',
      page: location.pathname
    });
    window.adpTrack('conversion', {
      send_to: ADS_CONVERSION,
      value: 500,
      currency: 'EUR',
      transaction_id: uri.split('/').pop()
    });
  });

  function init() {
    initInline();
    if (document.querySelector(SELECTOR)) {
      window.addEventListener('load', function () { setTimeout(loadWidget, 1500); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
