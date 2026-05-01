
/* Mobile nav final clean V2 */
(function(){
  function getHeader(){ return document.querySelector('header.nav') || document.querySelector('header'); }
  function getLinks(){ const h = getHeader(); return h ? h.querySelector('.nav-links') : null; }
  function getToggle(){
    const h = getHeader();
    return h ? h.querySelector('.hamburger, .menu-toggle, .nav-toggle, .mobile-toggle, button[aria-label*="menu" i]') : null;
  }
  function getPhoneHref(){
    const h = getHeader();
    const phone = h && (h.querySelector('.nav-cta a[href^="tel:"]') || h.querySelector('a[href^="tel:"]'));
    return phone ? phone.getAttribute('href') : 'tel:8437540102';
  }
  function getReserveHref(){
    const h = getHeader();
    const reserve = h && (
      h.querySelector('.nav-cta a[href*="order"]') ||
      h.querySelector('.nav-cta a[href*="reserve"]') ||
      h.querySelector('a[href*="order"]') ||
      h.querySelector('a[href*="reserve"]')
    );
    return reserve ? reserve.getAttribute('href') : 'order.html';
  }
  function injectExtras(){
    const l = getLinks();
    if(!l || l.querySelector('.mobile-nav-extra')) return;

    const wrap = document.createElement('div');
    wrap.className = 'mobile-nav-extra';
    wrap.innerHTML =
      '<a class="mobile-phone-link" href="' + getPhoneHref() + '">843-754-0102</a>' +
      '<a class="mobile-reserve-link" href="' + getReserveHref() + '">Reserve Now</a>';

    l.appendChild(wrap);
  }
  function setOpen(open){
    const h = getHeader();
    const l = getLinks();
    const t = getToggle();
    injectExtras();

    if(h){
      h.classList.toggle('nav-open', open);
      h.classList.toggle('menu-open', open);
    }
    document.body.classList.toggle('nav-open', open);
    document.body.classList.toggle('mobile-menu-open', open);
    if(l) l.setAttribute('aria-hidden', open ? 'false' : 'true');
    if(t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function isOpen(){ return document.body.classList.contains('nav-open'); }
  function init(){
    injectExtras();
    const h = getHeader();
    const l = getLinks();
    const t = getToggle();
    if(!h || !l || !t) return;

    setOpen(false);

    t.addEventListener('click', function(e){
      if(window.innerWidth <= 768){
        e.preventDefault();
        e.stopPropagation();
        setOpen(!isOpen());
      }
    });

    l.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ setOpen(false); });
    });

    document.addEventListener('click', function(e){
      if(window.innerWidth <= 768 && isOpen() && h && !h.contains(e.target)){
        setOpen(false);
      }
    });

    window.addEventListener('resize', function(){
      if(window.innerWidth > 768) setOpen(false);
    }, {passive:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
