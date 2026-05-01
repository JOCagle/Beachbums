/* Beach Bums mobile date picker — custom phone calendar + Booqable sync */
(function () {
  var MQ = '(max-width: 768px)';
  var monthCursor = startOfMonth(new Date());
  var startDate = null;
  var endDate = null;
  var overlay, triggerStart, triggerEnd;

  function isPhone() { return !window.matchMedia || window.matchMedia(MQ).matches; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function mmddyyyy(d) { return pad(d.getMonth()+1) + '-' + pad(d.getDate()) + '-' + d.getFullYear(); }
  function human(d) { return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); }
  function longHuman(d) { return d.toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' }); }
  function slash(d) { return pad(d.getMonth()+1) + '/' + pad(d.getDate()) + '/' + d.getFullYear(); }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth()+n, 1); }
  function sameDay(a,b){ return a && b && iso(a) === iso(b); }
  function inRange(d){ return startDate && endDate && d > startDate && d < endDate; }
  function todayMidnight(){ var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function text(el){ return ((el && el.textContent) || '').replace(/\s+/g,' ').trim(); }
  function fire(el, name) { try { el.dispatchEvent(new Event(name, { bubbles:true })); } catch(e) {} }

  function parseAnyDate(value) {
    if (!value) return null;
    var s = String(value);
    var d = new Date(s);
    if (!isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var m = s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (m) return new Date(Number(m[3].length === 2 ? '20'+m[3] : m[3]), Number(m[1])-1, Number(m[2]));
    return null;
  }

  function readExistingDates() {
    try {
      var saved = JSON.parse(localStorage.getItem('bb_mobile_dates') || '{}');
      if (saved.start) startDate = parseAnyDate(saved.start);
      if (saved.end) endDate = parseAnyDate(saved.end);
    } catch(e) {}
    var box = document.querySelector('.booqable-datepicker');
    var txt = box ? box.textContent : '';
    var matches = txt.match(/[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g) || [];
    if (!startDate && matches[0]) startDate = parseAnyDate(matches[0]);
    if (!endDate && matches[1]) endDate = parseAnyDate(matches[1]);
    if (startDate) monthCursor = startOfMonth(startDate);
  }

  function makeTrigger() {
    var real = document.querySelector('.bb-date-card > .booqable-datepicker');
    var card = document.querySelector('.bb-date-card');
    if (!real || !card || document.querySelector('.bb-mobile-date-trigger')) return;
    readExistingDates();
    var wrap = document.createElement('div');
    wrap.className = 'bb-mobile-date-trigger';
    wrap.innerHTML = '<button type="button" class="bb-trigger-start">Pick start date</button><button type="button" class="bb-trigger-end">Pick end date</button>';
    real.parentNode.insertBefore(wrap, real);
    triggerStart = wrap.querySelector('.bb-trigger-start');
    triggerEnd = wrap.querySelector('.bb-trigger-end');
    wrap.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openPicker(); }, true);
    updateTrigger();
  }

  function updateTrigger() {
    if (!triggerStart) return;
    triggerStart.textContent = startDate ? human(startDate) : 'Pick start date';
    triggerEnd.textContent = endDate ? human(endDate) : 'Pick end date';
  }

  function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'bbMobileCalendarOverlay';
    overlay.innerHTML = '<div class="bb-mobile-calendar-panel" role="dialog" aria-modal="true">' +
      '<div class="bb-mobile-calendar-head"><h3>Choose your dates</h3><button type="button" class="bb-mobile-calendar-close" aria-label="Close">×</button></div>' +
      '<div class="bb-mobile-calendar-summary"><div><small>START DATE</small><strong class="bb-sum-start">Select</strong></div><div><small>END DATE</small><strong class="bb-sum-end">Select</strong></div></div>' +
      '<div class="bb-mobile-month-nav"><button type="button" class="bb-prev" aria-label="Previous month">‹</button><strong class="bb-month-label"></strong><button type="button" class="bb-next" aria-label="Next month">›</button></div>' +
      '<div class="bb-mobile-calendar-scroll"><div class="bb-mobile-weekdays"><span>SU</span><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span></div><div class="bb-mobile-month-title"></div><div class="bb-mobile-days"></div></div>' +
      '<div class="bb-mobile-calendar-foot"><button type="button" class="bb-mobile-clear">Clear</button><button type="button" class="bb-mobile-apply">Apply</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.bb-mobile-calendar-close').addEventListener('click', closePicker);
    overlay.querySelector('.bb-prev').addEventListener('click', function(){ monthCursor = addMonths(monthCursor, -1); renderCalendar(); });
    overlay.querySelector('.bb-next').addEventListener('click', function(){ monthCursor = addMonths(monthCursor, 1); renderCalendar(); });
    overlay.querySelector('.bb-mobile-clear').addEventListener('click', function(){ startDate = null; endDate = null; updateTrigger(); renderCalendar(); });
    overlay.querySelector('.bb-mobile-apply').addEventListener('click', applyDates);
    overlay.addEventListener('touchmove', function(e){ e.stopPropagation(); }, { passive: true });
  }

  function openPicker() {
    if (!isPhone()) return;
    buildOverlay();
    if (startDate) monthCursor = startOfMonth(startDate);
    document.documentElement.classList.add('bb-mobile-calendar-open');
    renderCalendar();
  }
  function closePicker() { document.documentElement.classList.remove('bb-mobile-calendar-open'); }

  function renderCalendar() {
    if (!overlay) return;
    overlay.querySelector('.bb-sum-start').textContent = startDate ? human(startDate) : 'Select';
    overlay.querySelector('.bb-sum-end').textContent = endDate ? human(endDate) : 'Select';
    overlay.querySelector('.bb-month-label').textContent = monthCursor.toLocaleDateString(undefined, { month:'long', year:'numeric' });
    overlay.querySelector('.bb-mobile-month-title').textContent = monthCursor.toLocaleDateString(undefined, { month:'long', year:'numeric' });
    var days = overlay.querySelector('.bb-mobile-days');
    days.innerHTML = '';
    var first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    var last = new Date(monthCursor.getFullYear(), monthCursor.getMonth()+1, 0);
    for (var b=0; b<first.getDay(); b++) { var empty = document.createElement('button'); empty.className='bb-empty'; empty.type='button'; days.appendChild(empty); }
    var min = todayMidnight();
    for (var i=1; i<=last.getDate(); i++) {
      (function(day){
        var d = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(day);
        if (d < min) btn.classList.add('bb-disabled');
        if (sameDay(d,startDate) || sameDay(d,endDate)) btn.classList.add('bb-selected');
        if (inRange(d)) btn.classList.add('bb-inrange');
        btn.addEventListener('click', function(){
          if (d < min) return;
          if (!startDate || (startDate && endDate) || d < startDate) { startDate = d; endDate = null; }
          else if (+d === +startDate) { endDate = null; }
          else { endDate = d; }
          updateTrigger();
          renderCalendar();
        });
        days.appendChild(btn);
      })(i);
    }
  }

  async function applyDates() {
    if (!startDate || !endDate) { alert('Please choose a start date and end date.'); return; }
    updateTrigger();
    closePicker();
    persistDates();
    syncVisibleBooqableText();
    paintDateLabels();
    await syncBooqableAPI();
    automateHiddenBooqablePicker();
    setTimeout(paintDateLabels, 500);
    setTimeout(paintDateLabels, 1500);
  }

  function persistDates() {
    try {
      var payload = JSON.stringify({ start: iso(startDate), end: iso(endDate), startsAt: iso(startDate), stopsAt: iso(endDate) });
      localStorage.setItem('bb_start_date', iso(startDate));
      localStorage.setItem('bb_end_date', iso(endDate));
      localStorage.setItem('bb_starts_at', iso(startDate));
      localStorage.setItem('bb_stops_at', iso(endDate));
      localStorage.setItem('booqable_start_date', iso(startDate));
      localStorage.setItem('booqable_end_date', iso(endDate));
      localStorage.setItem('bb_mobile_dates', payload);
      sessionStorage.setItem('bb_mobile_dates', payload);
      document.cookie = 'bb_start_date=' + encodeURIComponent(iso(startDate)) + ';path=/;max-age=1209600;SameSite=Lax';
      document.cookie = 'bb_end_date=' + encodeURIComponent(iso(endDate)) + ';path=/;max-age=1209600;SameSite=Lax';
    } catch(e) {}
  }

  function syncVisibleBooqableText() {
    var real = document.querySelector('.booqable-datepicker');
    if (!real) return;
    real.setAttribute('data-bb-mobile-start', iso(startDate));
    real.setAttribute('data-bb-mobile-end', iso(endDate));
    real.setAttribute('data-start-date', iso(startDate));
    real.setAttribute('data-end-date', iso(endDate));
    var inputs = real.querySelectorAll('input');
    if (inputs[0]) { inputs[0].value = human(startDate); inputs[0].setAttribute('value', human(startDate)); fire(inputs[0], 'input'); fire(inputs[0], 'change'); }
    if (inputs[1]) { inputs[1].value = human(endDate); inputs[1].setAttribute('value', human(endDate)); fire(inputs[1], 'input'); fire(inputs[1], 'change'); }
  }

  function paintDateLabels() {
    if (!startDate || !endDate) return;
    updateTrigger();
    document.querySelectorAll('.bb-trigger-start').forEach(function(el){ el.textContent = human(startDate); });
    document.querySelectorAll('.bb-trigger-end').forEach(function(el){ el.textContent = human(endDate); });
  }

  async function callMaybe(fn, payload) {
    try { if (typeof fn === 'function') { var r = fn(payload); if (r && typeof r.then === 'function') await r; return true; } } catch(e) {}
    return false;
  }

  async function syncBooqableAPI() {
    var payloads = [
      { starts_at: iso(startDate), stops_at: iso(endDate) },
      { startsAt: iso(startDate), stopsAt: iso(endDate) },
      { start_date: iso(startDate), end_date: iso(endDate) },
      { from: iso(startDate), till: iso(endDate) },
      { start: iso(startDate), end: iso(endDate) },
      { period: { startsAt: iso(startDate), stopsAt: iso(endDate) } },
      { period: { starts_at: iso(startDate), stops_at: iso(endDate) } }
    ];
    var roots = [window.Booqable, window.booqable, window.Booqable && window.Booqable.cart, window.Booqable && window.Booqable.Cart];
    for (var r=0; r<roots.length; r++) {
      var obj = roots[r]; if (!obj) continue;
      for (var p=0; p<payloads.length; p++) {
        await callMaybe(obj.update, payloads[p]);
        await callMaybe(obj.setPeriod, payloads[p]);
        await callMaybe(obj.setRentalPeriod, payloads[p]);
        await callMaybe(obj.setDates, payloads[p]);
        await callMaybe(obj.setBookingPeriod, payloads[p]);
      }
    }
    document.querySelectorAll('.booqable-datepicker, .booqable-product-list, .booqable-cart').forEach(function(el){ fire(el, 'change'); fire(el, 'input'); });
  }

  function insideOurOverlay(n) { return !!(n && n.closest && n.closest('#bbMobileCalendarOverlay')); }
  function visibleEnough(n) {
    if (!n || insideOurOverlay(n)) return false;
    var cs = window.getComputedStyle ? window.getComputedStyle(n) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    return true;
  }

  function clickDayButton(root, d) {
    var wanted = String(d.getDate());
    var nodes = Array.prototype.slice.call(root.querySelectorAll('button,[role="button"],td,a'));
    var candidates = nodes.filter(function(n){
      if (!visibleEnough(n)) return false;
      var bad = String(n.className||'') + ' ' + String(n.getAttribute('aria-disabled')||'') + ' ' + String(n.disabled||'');
      return text(n) === wanted && !/disabled|unavailable|true/i.test(bad);
    });
    if (candidates[0]) { candidates[0].click(); return true; }
    return false;
  }

  function findApplyButton() {
    return Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a')).find(function(b){
      return visibleEnough(b) && !insideOurOverlay(b) && /^apply$/i.test(text(b));
    });
  }

  function startQuietBooqableSync() {
    try {
      document.documentElement.classList.add('bb-hide-native-datepicker');
      clearTimeout(window.__bbHideNativeDatepickerTimer);
      window.__bbHideNativeDatepickerTimer = setTimeout(function(){
        document.documentElement.classList.remove('bb-hide-native-datepicker');
      }, 2600);
    } catch(e) {}
  }

  function stopQuietBooqableSync() {
    try {
      clearTimeout(window.__bbHideNativeDatepickerTimer);
      window.__bbHideNativeDatepickerTimer = setTimeout(function(){
        document.documentElement.classList.remove('bb-hide-native-datepicker');
      }, 450);
    } catch(e) {}
  }

  function automateHiddenBooqablePicker() {
    startQuietBooqableSync();
    var real = document.querySelector('.bb-date-card > .booqable-datepicker');
    if (!real || !startDate || !endDate) { stopQuietBooqableSync(); return; }

    document.documentElement.classList.add('bb-bq-syncing');
    real.classList.add('bb-bq-syncing');

    var old = { position: real.style.position, left: real.style.left, top: real.style.top, width: real.style.width, height: real.style.height, opacity: real.style.opacity, pointerEvents: real.style.pointerEvents, zIndex: real.style.zIndex, overflow: real.style.overflow, transform: real.style.transform };

    function restore() {
      try { Object.keys(old).forEach(function(k){ real.style[k] = old[k] || ''; }); } catch(e) {}
            stopQuietBooqableSync();
      try { real.classList.remove('bb-bq-syncing'); document.documentElement.classList.remove('bb-bq-syncing'); } catch(e) {}
    }

    function wakeRealPicker() {
      try {
        real.style.setProperty('position', 'fixed', 'important');
        real.style.setProperty('left', '4px', 'important');
        real.style.setProperty('top', '4px', 'important');
        real.style.setProperty('width', '380px', 'important');
        real.style.setProperty('height', '96px', 'important');
        real.style.setProperty('opacity', '0.02', 'important');
        real.style.setProperty('pointer-events', 'auto', 'important');
        real.style.setProperty('z-index', '2147483000', 'important');
        real.style.setProperty('overflow', 'visible', 'important');
        real.click();
        ['pointerdown','mousedown','mouseup','click'].forEach(function(type){ try { real.dispatchEvent(new MouseEvent(type, { bubbles:true, cancelable:true, view:window })); } catch(e) {} });
        Array.prototype.slice.call(real.querySelectorAll('button,[role="button"],input,div,span')).slice(0,8).forEach(function(el){ try { el.click(); } catch(e) {} });
      } catch(e) {}
    }

    function clickNativeDatesAndApply(attempt) {
      attempt = attempt || 1;
      var clickedStart = clickDayButton(document, startDate);
      setTimeout(function(){
        var clickedEnd = clickDayButton(document, endDate);
        setTimeout(function(){
          var apply = findApplyButton();
          if (apply) apply.click();
          paintDateLabels();
          var B = window.Booqable || window.booqable;
          ['refresh','reload','render'].forEach(function(k){ try { if (B && typeof B[k] === 'function') B[k](); } catch(e){} });
          if ((!clickedStart || !clickedEnd || !apply) && attempt < 3) {
            wakeRealPicker();
            setTimeout(function(){ clickNativeDatesAndApply(attempt + 1); }, 300);
          } else {
            setTimeout(restore, 1800);
          }
        }, 220);
      }, 220);
    }

    wakeRealPicker();
    setTimeout(function(){ clickNativeDatesAndApply(1); }, 450);
  }

  function init() {
    if (!isPhone()) return;
    makeTrigger();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 400);
  setTimeout(init, 1200);
  try { new MutationObserver(init).observe(document.documentElement, { childList:true, subtree:true }); } catch(e) {}
})();

/* FINAL ADD-ON: sync the dates into Booqable's actual cart/reservation header too.
   This runs after the custom mobile picker saves dates. */
(function(){
  if (window.__BB_CART_RESERVATION_SYNC__) return;
  window.__BB_CART_RESERVATION_SYNC__ = true;

  // Mobile-only: desktop Booqable date picker already works.
  // Prevents date-picker flash when clicking Checkout on desktop.
  function isPhone(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }
  if (!isPhone()) return;

  function pad(n){ return String(n).padStart(2,'0'); }
  function parseIso(s){
    if (!s) return null;
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    return null;
  }
  function text(el){ return ((el && el.textContent) || '').replace(/\s+/g,' ').trim(); }
  function iso(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function mmddyyyy(d){ return pad(d.getMonth()+1) + '-' + pad(d.getDate()) + '-' + d.getFullYear(); }
  function visible(el){
    if (!el || !el.getBoundingClientRect) return false;
    if (el.closest && el.closest('#bbMobileCalendarOverlay')) return false;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }
  function savedDates(){
    try {
      var j = JSON.parse(localStorage.getItem('bb_mobile_dates') || '{}');
      var s = parseIso(j.start || localStorage.getItem('bb_start_date'));
      var e = parseIso(j.end || localStorage.getItem('bb_end_date'));
      return s && e ? {start:s, end:e} : null;
    } catch(e){ return null; }
  }

  function fire(el, type){
    try { el.dispatchEvent(new Event(type, {bubbles:true, cancelable:true})); } catch(e) {}
  }
  function mouse(el, type){
    try { el.dispatchEvent(new MouseEvent(type, {bubbles:true, cancelable:true, view:window})); } catch(e) {}
  }
  function tap(el){
    if (!el) return false;
    ['pointerdown','mousedown','mouseup','click'].forEach(function(type){ mouse(el,type); });
    try { el.click(); } catch(e) {}
    return true;
  }

  function hideBooqableSyncPanels(){
    if (!document.documentElement.classList.contains('bb-bq-syncing')) return;
    Array.prototype.slice.call(document.querySelectorAll('body *')).forEach(function(el){
      if (!el || !el.matches || !visible(el)) return;
      if (el.closest && el.closest('#bbMobileCalendarOverlay')) return;
      if (el.classList && el.classList.contains('bb-mobile-date-trigger')) return;
      var t = text(el);
      if (!t || t.length > 5000) return;
      var looksLikeTempBooqable = (/my reservation|your reservation|start date|reservation end date|clear dates|view cart|checkout|continue to payment/i.test(t) && /\d{2}[-\/]\d{2}[-\/]\d{4}|apply|edit|subtotal|cart/i.test(t));
      if (looksLikeTempBooqable) { try { el.classList.add('bb-hide-bq-sync-panel'); } catch(e) {} }
    });
  }

  function unhideBooqableSyncPanels(){
    Array.prototype.slice.call(document.querySelectorAll('.bb-hide-bq-sync-panel')).forEach(function(el){ try { el.classList.remove('bb-hide-bq-sync-panel'); } catch(e) {} });
  }

  function findCartPanel(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll('body *')).filter(visible);
    var best = null, scoreBest = 0;
    nodes.forEach(function(el){
      var t = text(el);
      if (t.length > 6000) return;
      var score = 0;
      if (/my reservation/i.test(t)) score += 10;
      if (/your reservation/i.test(t)) score += 6;
      if (/view cart|checkout|subtotal|continue to payment/i.test(t)) score += 5;
      if (/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(t)) score += 4;
      if (/edit/i.test(t)) score += 2;
      if (score > scoreBest) { scoreBest = score; best = el; }
    });
    return scoreBest >= 8 ? best : null;
  }

  function findDateEditorClickTarget(panel){
    if (!panel) return null;
    var buttons = Array.prototype.slice.call(panel.querySelectorAll('button,[role="button"],a,svg,*')).filter(visible);
    var edit = buttons.find(function(b){ return /^edit$/i.test(text(b)); });
    if (edit) return edit;
    var tune = buttons.find(function(b){
      var label = ((b.getAttribute && (b.getAttribute('aria-label') || b.getAttribute('title') || b.getAttribute('class'))) || '').toString();
      return /edit|date|period|reservation|setting|sliders|tune|calendar/i.test(label);
    });
    if (tune) return tune;
    var dateEl = buttons.find(function(b){ return /\d{2}[-\/]\d{2}[-\/]\d{4}/.test(text(b)); });
    if (dateEl) return dateEl;
    return panel;
  }

  function findDayButton(day){
    var want = String(day);
    var nodes = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],td,a,div,span')).filter(visible);
    return nodes.find(function(n){
      if (n.closest && n.closest('#bbMobileCalendarOverlay')) return false;
      var bad = String(n.className || '') + ' ' + String(n.getAttribute && (n.getAttribute('aria-disabled') || n.getAttribute('disabled') || ''));
      return text(n) === want && !/disabled|unavailable|not-allowed|true/i.test(bad);
    });
  }

  function findApply(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a')).filter(visible);
    return nodes.find(function(n){ return !n.closest('#bbMobileCalendarOverlay') && /^apply$|^done$|^save$/i.test(text(n)); });
  }

  function clickBooqableDates(dates, attempt){
    attempt = attempt || 1;
    var sbtn = findDayButton(dates.start.getDate());
    tap(sbtn);
    setTimeout(function(){
      var ebtn = findDayButton(dates.end.getDate());
      tap(ebtn);
      setTimeout(function(){
        var apply = findApply();
        tap(apply);
        setTimeout(function(){ forceBooqableText(dates); }, 350);
        if ((!sbtn || !ebtn || !apply) && attempt < 4) {
          setTimeout(function(){ clickBooqableDates(dates, attempt+1); }, 500);
        }
      }, 250);
    }, 250);
  }

  function forceBooqableText(dates){
    var startText = mmddyyyy(dates.start);
    var endText = mmddyyyy(dates.end);
    // This is just visual backup; the click automation above is what updates Booqable's real state.
    Array.prototype.slice.call(document.querySelectorAll('*')).forEach(function(el){
      if (!visible(el) || (el.children && el.children.length > 0)) return;
      var t = text(el);
      if (/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(t)) {
        if (!forceBooqableText._doneStart) { try { el.textContent = startText; } catch(e){} forceBooqableText._doneStart = true; }
        else if (!forceBooqableText._doneEnd) { try { el.textContent = endText; } catch(e){} forceBooqableText._doneEnd = true; }
      }
    });
    forceBooqableText._doneStart = false;
    forceBooqableText._doneEnd = false;
  }

  function syncCartReservation(){
    var dates = savedDates();
    if (!dates) return;
    document.documentElement.classList.add('bb-bq-syncing');
    hideBooqableSyncPanels();
    var panel = findCartPanel();
    if (!panel) { document.documentElement.classList.remove('bb-bq-syncing'); return; }
    if (panel) { try { panel.classList.add('bb-hide-bq-sync-panel'); } catch(e){} }
    var target = findDateEditorClickTarget(panel);
    tap(target);
    [40,120,250,450,800,1200,1800,2600,3600].forEach(function(ms){ setTimeout(hideBooqableSyncPanels, ms); });
    setTimeout(function(){ clickBooqableDates(dates, 1); }, 550);
    setTimeout(function(){ unhideBooqableSyncPanels(); document.documentElement.classList.remove('bb-bq-syncing'); }, 6500);
  }

  // Hook the custom Apply button without touching the working mobile UI.
  document.addEventListener('click', function(e){
    if (e.target && e.target.closest && e.target.closest('.bb-mobile-apply')) {
      setTimeout(syncCartReservation, 950);
      setTimeout(syncCartReservation, 2200);
      setTimeout(syncCartReservation, 4200);
    }
  }, true);

  // Also try right before checkout/view-cart in case the cart opened after Apply.
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('button,a,[role="button"]') : null;
    if (b && /checkout|view cart|continue to payment/i.test(text(b))) {
      if (isPhone() && document.querySelector('.bb-mobile-date-trigger') && !document.documentElement.classList.contains('bb-bq-syncing')) {
        syncCartReservation();
      }
    }
  }, true);
})();
