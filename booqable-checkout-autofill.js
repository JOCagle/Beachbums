/* Beach Bums → Booqable Checkout Script (fixed + hardened)
   Paste into:
   Booqable → Settings → Online bookings → Checkout → Additional scripts
*/

// Redirect anyone who visits the checkout root URL directly
(function () {
  const href = String(window.location.href || '');
  const path = String(window.location.pathname || '');
  const hasCheckoutSession = /\/checkouts\//i.test(href) || /\/success\b/i.test(path);
  const isBareRoot = path === 'index.html' || path === '';
  if (isBareRoot && !hasCheckoutSession) {
    window.location.replace('https://www.beachbumsiop.com');
  }
})();

(function () {
  const MAX_TRIES = 160;
  const TRY_EVERY_MS = 300;
  const STORAGE_PREFIX = 'bb_checkout_';
  const AUTO_FILLED_ATTR = 'data-bb-autofilled';

  let savedAccess = '';
  let cachedPayload = null;
  let currentSessionId = '';

  function readCookie(name) {
    try {
      const m = document.cookie.match(
        new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
      );
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) {
      return '';
    }
  }

  function setLocal(key, value) {
    try {
      if (value === '' || value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch (e) {}
  }

  function getLocal(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeLabel(value) {
    return normalize(value).toLowerCase();
  }

  function cleanAccess(value) {
    let v = normalize(value);
    v = v.replace(/^selected\s*access\s*point\s*:\s*/i, '');
    v = v.replace(/\s*\(popular pick\)\s*/ig, '');
    v = normalize(v);

    const badValues = [
      '', '?', 'closest to address provided', 'closest to address',
      'popular pick', 'undefined', 'null', 'none', '(none yet)'
    ];

    return badValues.includes(v.toLowerCase()) ? '' : v;
  }

  function safeParseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function getPayload() {
    if (cachedPayload) return cachedPayload;
    const raw = getLocal('bb_order_payload') || readCookie('bb_order_payload');
    cachedPayload = safeParseJson(raw);
    return cachedPayload;
  }

  function getPayloadAccess() {
    const payload = getPayload();
    if (!payload) return '';
    const chosen = payload.chosenAccess;
    if (typeof chosen === 'string') return cleanAccess(chosen);
    if (chosen && typeof chosen === 'object' && chosen.name) return cleanAccess(chosen.name);
    return '';
  }

  function getPayloadCustomer() {
    const payload = getPayload();
    return payload && payload.customer ? payload.customer : {};
  }

  function getCurrentSessionId() {
    if (currentSessionId) return currentSessionId;
    const payload = getPayload();
    currentSessionId = normalize(
      (payload && payload.meta && payload.meta.sessionId) ||
      getLocal('bb_checkout_session') ||
      readCookie('bb_checkout_session')
    );
    return currentSessionId;
  }

  function getBestAccessPointValue() {
    const candidates = [
      getPayloadAccess(),
      getParam('bb_access_point'),
      getParam('beach_access'),
      readCookie('bb_access_point'),
      readCookie('bb_beach_access'),
      getLocal('bb_access_point'),
      getLocal('bb_beach_access'),
      getParam('bb_delivery_note'),
      readCookie('bb_delivery_note'),
      getLocal('bb_delivery_note')
    ];

    for (const candidate of candidates) {
      const cleaned = cleanAccess(candidate);
      if (cleaned) return cleaned;
    }
    return '';
  }

  function findFieldByLabelContains(text) {
    const needle = normalizeLabel(text);
    const labels = Array.from(document.querySelectorAll('label'));

    for (const label of labels) {
      const labelText = normalizeLabel(label.textContent);
      if (!labelText.includes(needle)) continue;

      const forId = label.getAttribute('for');
      if (forId) {
        const byId = document.getElementById(forId);
        if (byId) return byId;
      }

      let wrap = label.parentElement;
      for (let i = 0; i < 6 && wrap; i++) {
        const input = wrap.querySelector('input, textarea');
        if (input) return input;
        wrap = wrap.parentElement;
      }
    }

    return null;
  }

  function findField(selectorList) {
    for (const selector of selectorList) {
      const match = document.querySelector(selector);
      if (match) return match;
    }
    return null;
  }

  function findAccessField() {
    return (
      findField([
        'input[placeholder*="access" i]',
        'input[aria-label*="access" i]',
        'input[name*="access" i]',
        'textarea[placeholder*="access" i]',
        'textarea[aria-label*="access" i]'
      ]) ||
      findFieldByLabelContains('selected access point') ||
      findFieldByLabelContains('selected access') ||
      findFieldByLabelContains('beach location') ||
      null
    );
  }

  function findOtherBeachAccessField() {
    return findFieldByLabelContains('other beach accesses');
  }

  function findNameField() {
    return findFieldByLabelContains('full name') || findFieldByLabelContains('name');
  }

  function findFirstNameField() {
    return findFieldByLabelContains('first name');
  }

  function findLastNameField() {
    return findFieldByLabelContains('last name');
  }

  function findEmailField() {
    return findField(['input[type="email"]']) || findFieldByLabelContains('email');
  }

  function findPhoneField() {
    return findField(['input[type="tel"]']) || findFieldByLabelContains('phone');
  }

  function findInstructionField() {
    return findFieldByLabelContains('special') || findFieldByLabelContains('instruction') || findFieldByLabelContains('comment');
  }

  function setNativeValue(el, value) {
    const prototype = Object.getPrototypeOf(el);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(el, value);
    else el.value = value;
  }

  function dispatchFieldEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function fieldLooksUserOwned(el) {
    if (!el) return false;
    return el.getAttribute(AUTO_FILLED_ATTR) !== 'true' && normalize(el.value).length > 0;
  }

  function applyFieldValue(el, value, options) {
    if (!el) return false;
    const normalizedValue = normalize(value);
    if (!normalizedValue) return false;

    const currentRaw = normalize(el.value);
    const currentClean = options && options.cleaner ? options.cleaner(currentRaw) : currentRaw;
    const nextClean = options && options.cleaner ? options.cleaner(normalizedValue) : normalizedValue;

    if (currentClean === nextClean) {
      if (options && options.markAutofilled) el.setAttribute(AUTO_FILLED_ATTR, 'true');
      return true;
    }

    if (fieldLooksUserOwned(el) && !(options && options.force)) {
      return false;
    }

    setNativeValue(el, normalizedValue);
    if (options && options.markAutofilled) el.setAttribute(AUTO_FILLED_ATTR, 'true');
    dispatchFieldEvents(el);
    return true;
  }

  function persistField(label, el, key) {
    if (!el || el.dataset.bbCaptured === 'true') return;
    el.dataset.bbCaptured = 'true';

    const save = function () {
      const val = normalize(el.value);
      setLocal(STORAGE_PREFIX + key, val);
    };

    el.addEventListener('input', save, true);
    el.addEventListener('change', save, true);
    el.addEventListener('blur', save, true);

    setTimeout(save, 50);
    setTimeout(save, 400);
  }

  function wireCaptureFields() {
    persistField('name', findNameField(), 'name');
    persistField('first_name', findFirstNameField(), 'first_name');
    persistField('last_name', findLastNameField(), 'last_name');
    persistField('email', findEmailField(), 'email');
    persistField('phone', findPhoneField(), 'phone');
    persistField('instructions', findInstructionField(), 'instructions');

    Array.from(document.querySelectorAll('textarea')).forEach(function (ta) {
      persistField('textarea', ta, 'instructions');
    });
  }

  function fillCustomerFieldsFromPayload() {
    const customer = getPayloadCustomer();
    if (!customer || typeof customer !== 'object') return;

    const firstName = normalize(customer.firstName || '');
    const lastName = normalize(customer.lastName || '');
    const fullName = normalize([firstName, lastName].filter(Boolean).join(' '));
    const email = normalize(customer.email || '');
    const phone = normalize(customer.phone || '');

    applyFieldValue(findFirstNameField(), firstName, { markAutofilled: true });
    applyFieldValue(findLastNameField(), lastName, { markAutofilled: true });
    applyFieldValue(findNameField(), fullName, { markAutofilled: true });
    applyFieldValue(findEmailField(), email, { markAutofilled: true });
    applyFieldValue(findPhoneField(), phone, { markAutofilled: true });
  }

  function fillAccessFields() {
    savedAccess = cleanAccess(savedAccess || getBestAccessPointValue());
    if (!savedAccess) return false;

    const selectedEl = findAccessField();
    const otherEl = findOtherBeachAccessField();

    let didFill = false;
    if (selectedEl) {
      didFill = applyFieldValue(selectedEl, savedAccess, {
        cleaner: cleanAccess,
        markAutofilled: true,
        force: selectedEl.getAttribute(AUTO_FILLED_ATTR) === 'true'
      }) || didFill;
    }

    if (otherEl) {
      didFill = applyFieldValue(otherEl, `Selected access point: ${savedAccess}`, {
        markAutofilled: true,
        force: otherEl.getAttribute(AUTO_FILLED_ATTR) === 'true'
      }) || didFill;
    }

    return didFill;
  }

  function scrapeVisibleText() {
    return normalize(document.body && document.body.innerText);
  }

  function extractSuccessOrderNumber(text) {
    const match = text.match(/reservation\s+number\s+is\s+#?(\d+)/i);
    return match ? match[1] : '';
  }

  function extractSuccessDates(text) {
    const matches = text.match(/(\d{2}-\d{2}-\d{4})/g) || [];
    function toISO(mmddyyyy) {
      const parts = String(mmddyyyy).split('-');
      return parts.length === 3 ? `${parts[2]}-${parts[0]}-${parts[1]}` : '';
    }
    return {
      start: matches[0] ? toISO(matches[0]) : '',
      end: matches[1] ? toISO(matches[1]) : (matches[0] ? toISO(matches[0]) : '')
    };
  }

  function extractSuccessItems(text) {
    const items = [];
    const matches = text.match(/(\d+)x\s+(.+?)(?:\$[\d,.]+|$)/gm) || [];
    matches.forEach(function (match) {
      const parts = match.match(/(\d+)x\s+(.+?)(?:\s*\$|$)/);
      if (parts) {
        items.push({ quantity: parseInt(parts[1], 10), name: normalize(parts[2]) });
      }
    });
    return items;
  }

  function extractSuccessTotal(text) {
    const match = text.match(/Total\s+\$?([\d,.]+)/i);
    return match ? Number(String(match[1]).replace(/,/g, '')) : 0;
  }

  function buildFinalPayloadFromSources() {
    const payload = getPayload() || {};
    const visibleText = scrapeVisibleText();
    const customer = getPayloadCustomer();
    const firstName = normalize(getLocal(STORAGE_PREFIX + 'first_name') || customer.firstName || '');
    const lastName = normalize(getLocal(STORAGE_PREFIX + 'last_name') || customer.lastName || '');
    const combinedName = normalize(getLocal(STORAGE_PREFIX + 'name') || [firstName, lastName].filter(Boolean).join(' '));
    const nameParts = combinedName ? combinedName.split(/\s+/) : [];

    const finalFirst = firstName || nameParts[0] || '';
    const finalLast = lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    const datesFromPage = extractSuccessDates(visibleText);
    const access = cleanAccess(getBestAccessPointValue() || getPayloadAccess());

    return {
      orderId: payload.orderId || ('BQ-' + (extractSuccessOrderNumber(visibleText) || Date.now())),
      meta: payload.meta || { sessionId: getCurrentSessionId(), updatedAt: Date.now() },
      dates: {
        start: (payload.dates && payload.dates.start) || datesFromPage.start || '',
        end: (payload.dates && payload.dates.end) || datesFromPage.end || ''
      },
      customer: {
        firstName: finalFirst,
        lastName: finalLast,
        email: normalize(getLocal(STORAGE_PREFIX + 'email') || customer.email || ''),
        phone: normalize(getLocal(STORAGE_PREFIX + 'phone') || customer.phone || '')
      },
      address: normalize(getLocal(STORAGE_PREFIX + 'instructions') || payload.address || ''),
      chosenAccess: access,
      qty: payload.qty || {},
      totals: {
        ...(payload.totals || {}),
        total: Number((payload.totals && payload.totals.total) || extractSuccessTotal(visibleText) || 0)
      },
      items: payload.items || extractSuccessItems(visibleText),
      payment: payload.payment || { method: 'booqable', status: 'paid' }
    };
  }

  function clearCheckoutCaptureData() {
    [
      STORAGE_PREFIX + 'name',
      STORAGE_PREFIX + 'first_name',
      STORAGE_PREFIX + 'last_name',
      STORAGE_PREFIX + 'email',
      STORAGE_PREFIX + 'phone',
      STORAGE_PREFIX + 'instructions'
    ].forEach(function (key) { setLocal(key, ''); });
  }

  function onSuccessPage() {
    let isSending = false;
    let hasSaved = false;

    function maybeSend() {
      if (!/\/success\b/i.test(window.location.pathname) || isSending || hasSaved) return;

      const visibleText = scrapeVisibleText();
      if (!visibleText || (!/thank you/i.test(visibleText) && !/reservation/i.test(visibleText))) return;

      const finalPayload = buildFinalPayloadFromSources();
      const sessionId = normalize(finalPayload.meta && finalPayload.meta.sessionId);
      const orderId = normalize(finalPayload.orderId);
      if (!orderId) return;

      const dedupeKey = `bb_saved_order_${orderId}`;
      if (getLocal(dedupeKey)) {
        hasSaved = true;
        return;
      }

      isSending = true;
      fetch('https://www.beachbumsiop.com/api/save-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('save-order failed');
          setLocal(dedupeKey, 'true');
          if (sessionId) setLocal('bb_last_saved_session', sessionId);
          clearCheckoutCaptureData();
          hasSaved = true;
          isSending = false;
        })
        .catch(function () {
          isSending = false;
        });
    }

    setInterval(maybeSend, 1000);
    window.addEventListener('load', function () { setTimeout(maybeSend, 700); });
  }

  function start() {
    savedAccess = getBestAccessPointValue();
    wireCaptureFields();
    fillCustomerFieldsFromPayload();
    fillAccessFields();
    onSuccessPage();

    let tries = 0;
    const intervalId = setInterval(function () {
      tries += 1;
      wireCaptureFields();
      fillCustomerFieldsFromPayload();
      fillAccessFields();
      if (tries >= MAX_TRIES) clearInterval(intervalId);
    }, TRY_EVERY_MS);

    const observer = new MutationObserver(function () {
      wireCaptureFields();
      fillCustomerFieldsFromPayload();
      fillAccessFields();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        wireCaptureFields();
        fillCustomerFieldsFromPayload();
        fillAccessFields();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

/* Redirect any cart links/buttons to your gear page */
(function () {
  const TARGET = 'https://www.beachbumsiop.comhttps://beachbumsiop.com/order-gear';

  function go(e) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = TARGET;
  }

  function fixCartLinks() {
    document.querySelectorAll('button, a').forEach(function (el) {
      const txt = normalizeCartText(el.textContent || '');
      if (txt === 'view cart' || txt === 'back to cart') {
        if (el.tagName.toLowerCase() === 'a') {
          el.setAttribute('href', TARGET);
          el.setAttribute('target', '_self');
        } else if (!el.dataset.bbCartBound) {
          el.addEventListener('click', go, true);
          el.dataset.bbCartBound = 'true';
        }
      }
    });

    document.querySelectorAll('a[href*="/carts/"], a[href*="/cart"]').forEach(function (a) {
      a.setAttribute('href', TARGET);
      a.setAttribute('target', '_self');
    });
  }

  function normalizeCartText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  fixCartLinks();
  new MutationObserver(fixCartLinks).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
