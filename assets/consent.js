/* Bandeau de consentement + mesure d'audience (GA4, Google Ads).
   Rien n'est chargé chez Google tant que le visiteur n'a pas accepté.
   Le choix est conservé 6 mois, puis redemandé (recommandation CNIL). */
(function () {
  var KEY = 'adp_consent';
  var MAX_AGE = 182 * 24 * 3600 * 1000;
  var GA = 'G-4W6DFT6X8X';
  var ADS = 'AW-18294420606';
  var started = false;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  function readChoice() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.v || Date.now() - c.t > MAX_AGE) return null;
      return c.v;
    } catch (e) { return null; }
  }

  function saveChoice(v) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }

  function startTracking() {
    if (started) return;
    started = true;
    gtag('consent', 'default', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'granted', analytics_storage: 'granted'
    });
    gtag('js', new Date());
    gtag('config', GA);
    gtag('config', ADS);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(s);
  }

  function track(name, params) {
    if (started) gtag('event', name, params || {});
  }

  /* Utilisés par assets/calendly.js */
  window.adpTrack = track;
  window.adpConsent = { granted: function () { return readChoice() === 'granted'; } };

  /* --- Bandeau --- */
  var css =
    '#adp-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:760px;margin:0 auto;' +
    'background:#1F3A5F;color:#FAF7F1;border-radius:10px;padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,.25);' +
    'font-family:Inter,system-ui,sans-serif;font-size:.92rem;line-height:1.5}' +
    '#adp-consent p{margin:0 0 12px;color:#FAF7F1}' +
    '#adp-consent a{color:#C8A35C;text-decoration:underline}' +
    '#adp-consent .adp-btns{display:flex;gap:10px;flex-wrap:wrap}' +
    '#adp-consent button{flex:1 1 140px;cursor:pointer;border-radius:6px;padding:10px 16px;font:600 .92rem Inter,system-ui,sans-serif;' +
    'border:1px solid #C8A35C}' +
    '#adp-consent .adp-yes{background:#C8A35C;color:#1F3A5F}' +
    '#adp-consent .adp-no{background:transparent;color:#FAF7F1}' +
    '#adp-consent button:focus-visible{outline:2px solid #FAF7F1;outline-offset:2px}';

  function showBanner() {
    if (document.getElementById('adp-consent')) return;
    if (!document.getElementById('adp-consent-css')) {
      var st = document.createElement('style');
      st.id = 'adp-consent-css';
      st.textContent = css;
      document.head.appendChild(st);
    }
    var box = document.createElement('div');
    box.id = 'adp-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Choix des cookies');
    box.innerHTML =
      '<p>Avec votre accord, ce site utilise Google Analytics et Google Ads pour mesurer sa fréquentation ' +
      'et l\'efficacité de ses annonces. Refuser ne change rien à votre navigation. ' +
      '<a href="/cookies.html">En savoir plus</a></p>' +
      '<div class="adp-btns"><button type="button" class="adp-no">Refuser</button>' +
      '<button type="button" class="adp-yes">Accepter</button></div>';
    document.body.appendChild(box);
    box.querySelector('.adp-yes').addEventListener('click', function () {
      saveChoice('granted');
      box.remove();
      startTracking();
      document.dispatchEvent(new Event('adp:consent-granted'));
    });
    box.querySelector('.adp-no').addEventListener('click', function () {
      var wasStarted = started;
      saveChoice('denied');
      box.remove();
      if (wasStarted) location.reload();
    });
  }

  /* --- Suivi des prises de contact (les réservations Calendly sont dans calendly.js) --- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a, [data-consent-open]') : null;
    if (!el) return;
    if (el.hasAttribute('data-consent-open')) {
      e.preventDefault();
      showBanner();
      return;
    }
    var href = el.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) track('clic_telephone', { page: location.pathname });
    else if (href.indexOf('mailto:') === 0) track('clic_email', { page: location.pathname });
  });

  /* --- Formulaire de contact ---
     Envoi à Formspree sans quitter la page. form_submit n'est envoyé qu'une
     fois Formspree ayant confirmé la réception. En cas d'échec, le formulaire
     repart par l'envoi classique pour ne perdre aucun message (sans mesure). */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || (f.getAttribute('action') || '').indexOf('formspree.io') === -1) return;
    if (!window.fetch || !window.FormData) return;
    e.preventDefault();
    if (f.getAttribute('data-sending')) return;
    f.setAttribute('data-sending', '1');
    var btn = f.querySelector('[type="submit"]');
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }
    fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Formspree ' + r.status);
        track('form_submit', { method: 'formulaire_contact', page: location.pathname });
        var done = document.createElement('div');
        done.setAttribute('role', 'status');
        done.style.cssText = 'padding:2rem 1rem;text-align:center';
        done.innerHTML = '<h3 style="font-family:\'Playfair Display\';margin-bottom:.8rem">Merci, votre demande est bien envoyée</h3>' +
          '<p>Je vous réponds sous 24 h ouvrées. Pour une question urgente : <a href="tel:+33620880909">06 20 88 09 09</a>.</p>';
        f.innerHTML = '';
        f.appendChild(done);
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        HTMLFormElement.prototype.submit.call(f);
      });
  });

  function init() {
    var choice = readChoice();
    if (choice === 'granted') startTracking();
    else if (choice === null) showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
