/**
 * Beach Bums -> Booqable checkout bridge
 * Saves the latest selected access point + payload and forwards the checkout session params.
 */
(function(){
  const COOKIE_DOMAIN = ".beachbumsiop.com";
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

  function isLocalHost() {
    const h = (location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1';
  }

  function setCookie(name, value) {
    try {
      let cookie = `${name}=${encodeURIComponent(String(value || ''))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=None`;
      if (location.protocol === 'https:') cookie += '; Secure';
      if (!isLocalHost()) cookie += `; domain=${COOKIE_DOMAIN}`;
      document.cookie = cookie;
    } catch (e) {}
  }

  function cleanAccess(value) {
    return String(value || '')
      .replace(/^selected\s*access\s*point\s*:\s*/i, '')
      .replace(/\s*\(popular pick\)\s*/ig, '')
      .trim();
  }

  function getOrderPayload() {
    try {
      return localStorage.getItem('bb_order_payload') || '';
    } catch (e) {
      return '';
    }
  }

  function getSelectedAccessPoint() {
    const direct = cleanAccess(window.selectedAccessPoint || '');
    if (direct) return direct;

    try {
      const raw = localStorage.getItem('beachbums_order_v3');
      if (!raw) return '';
      const data = JSON.parse(raw);
      const ca = data && data.chosenAccess;
      if (typeof ca === 'string') return cleanAccess(ca);
      if (ca && typeof ca === 'object' && ca.name) return cleanAccess(ca.name);
    } catch (e) {}

    return '';
  }

  window.goToCheckout = function goToCheckout() {
    const ap = getSelectedAccessPoint();
    if (!ap) {
      alert('Please select a beach access point.');
      return;
    }

    const note = `Selected access point: ${ap}`;
    const payload = getOrderPayload();
    const sessionId = (function(){
      try { return localStorage.getItem('bb_checkout_session') || ''; } catch (e) { return ''; }
    })();

    setCookie('bb_access_point', ap);
    setCookie('bb_beach_access', ap);
    setCookie('bb_delivery_note', note);
    if (sessionId) setCookie('bb_checkout_session', sessionId);
    if (payload) setCookie('bb_order_payload', payload);

    try { localStorage.setItem('bb_access_point', ap); } catch (e) {}
    try { localStorage.setItem('bb_beach_access', ap); } catch (e) {}
    try { localStorage.setItem('bb_delivery_note', note); } catch (e) {}

    const baseUrl = (window.BB_CHECKOUT_URL || 'https://checkout.beachbumsiop.com/checkout').toString();
    const u = new URL(baseUrl, window.location.href);
    u.searchParams.set('bb_access_point', ap);
    u.searchParams.set('bb_delivery_note', note);
    if (sessionId) u.searchParams.set('bb_checkout_session', sessionId);

    setTimeout(() => { window.location.href = u.toString(); }, 80);
  };
})();


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
