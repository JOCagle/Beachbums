(function(){
  'use strict';

  var MOBILE = window.matchMedia && window.matchMedia('(max-width: 800px)').matches;
  if (!MOBILE) return;

  var BTN_ID = 'bb-3step-apply-dates';
  var lastAutoOpen = 0;
  var lastModalKey = '';

  function isVisible(el){
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) !== 0;
  }
  function txt(el){ return ((el && el.innerText) || (el && el.textContent) || '').replace(/\s+/g,' ').trim(); }

  function findRentalModal(){
    var all = Array.prototype.slice.call(document.body.querySelectorAll('div, section, aside, main'));
    var best = null, bestScore = -1;
    all.forEach(function(el){
      if (!isVisible(el)) return;
      var t = txt(el).toLowerCase();
      if (!(t.indexOf('start date') >= 0 && t.indexOf('reservation end date') >= 0)) return;
      var r = el.getBoundingClientRect();
      if (r.width < 260 || r.height < 200) return;
      var score = r.width * r.height;
      if (t.indexOf('select a rental period') >= 0) score += 999999;
      if (t.indexOf('clear dates') >= 0) score += 500000;
      if (score > bestScore) { best = el; bestScore = score; }
    });
    return best;
  }

  function isCalendarOpen(modal){
    if (!modal) return false;
    var t = txt(modal).toLowerCase();
    var hasMonth = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d\d/.test(t);
    var hasWeekdays = /\bsu\b.*\bmo\b.*\btu\b.*\bwe\b.*\bth\b.*\bfr\b.*\bsa\b/i.test(txt(modal));
    return hasMonth || hasWeekdays;
  }

  function getButtons(root){
    return Array.prototype.slice.call((root || document).querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], div, span'))
      .filter(isVisible);
  }

  function findRealApply(modal){
    var buttons = getButtons(modal);
    for (var i=0; i<buttons.length; i++){
      var label = (buttons[i].value || txt(buttons[i])).trim().toLowerCase();
      if (label === 'apply') return buttons[i];
    }
    return null;
  }

  function findInnerClose(modal){
    var m = modal.getBoundingClientRect();
    var buttons = getButtons(modal).filter(function(el){
      var label = (el.getAttribute('aria-label') || el.title || txt(el)).trim().toLowerCase();
      if (!(label === '×' || label === 'x' || label === 'close' || label.indexOf('close') >= 0)) return false;
      var r = el.getBoundingClientRect();
      return r.top > m.top + 28 && r.top < m.top + 100 && r.left > m.left + (m.width * 0.66);
    });
    if (buttons.length) {
      buttons.sort(function(a,b){ return b.getBoundingClientRect().top - a.getBoundingClientRect().top; });
      return buttons[0];
    }
    return null;
  }

  function findDateFieldToClick(modal){
    var m = modal.getBoundingClientRect();
    var items = Array.prototype.slice.call(modal.querySelectorAll('*')).filter(isVisible);
    var candidates = [];
    items.forEach(function(el){
      var t = txt(el);
      if (!/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(t)) return;
      var r = el.getBoundingClientRect();
      if (r.top < m.top || r.top > m.top + 190) return;
      candidates.push({el:el, left:r.left, top:r.top});
    });
    candidates.sort(function(a,b){ return a.left - b.left; });
    return candidates[0] && candidates[0].el;
  }

  function safeClick(el){
    if (!el) return false;
    try { el.click(); return true; } catch(e) {}
    try {
      var r = el.getBoundingClientRect();
      var opts = {bubbles:true, cancelable:true, clientX:r.left + r.width/2, clientY:r.top + r.height/2};
      ['pointerdown','mousedown','mouseup','pointerup','click'].forEach(function(type){
        el.dispatchEvent(new MouseEvent(type, opts));
      });
      return true;
    } catch(e2) {}
    return false;
  }

  function ensureButton(){
    var btn = document.getElementById(BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.textContent = 'Apply Dates';
      btn.addEventListener('click', applyDates, true);
      document.body.appendChild(btn);
    }
    return btn;
  }
  function hideButton(){ var btn = document.getElementById(BTN_ID); if (btn) btn.style.display = 'none'; }
  function showButton(){ ensureButton().style.display = 'block'; }

  function applyDates(ev){
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var modal = findRentalModal();
    if (!modal) return;

    var real = findRealApply(modal);
    if (real) { safeClick(real); hideButton(); return; }

    var x = findInnerClose(modal);
    if (x) safeClick(x);

    [120, 280, 500, 800, 1200, 1700].forEach(function(ms){
      setTimeout(function(){
        var m = findRentalModal();
        if (!m) { hideButton(); return; }
        var a = findRealApply(m);
        if (a) { safeClick(a); hideButton(); }
      }, ms);
    });
  }

  function autoOpenCalendar(modal){
    var now = Date.now();
    var key = txt(modal).slice(0, 220);
    if (key === lastModalKey && now - lastAutoOpen < 2600) return;
    if (isCalendarOpen(modal)) return;
    if (findRealApply(modal)) return;
    var field = findDateFieldToClick(modal);
    if (!field) return;
    lastModalKey = key;
    lastAutoOpen = now;
    setTimeout(function(){ safeClick(field); }, 160);
  }

  function tick(){
    var modal = findRentalModal();
    if (!modal) { hideButton(); return; }

    autoOpenCalendar(modal);

    var calOpen = isCalendarOpen(modal);
    var realApply = findRealApply(modal);
    if (calOpen && !realApply) showButton();
    else hideButton();
  }

  function start(){
    try { new MutationObserver(tick).observe(document.body, {childList:true, subtree:true, attributes:true, characterData:true}); } catch(e) {}
    setInterval(tick, 300);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();