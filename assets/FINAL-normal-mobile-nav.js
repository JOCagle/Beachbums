
/* Final simple mobile nav toggle */
(function(){
  function getHeader(){ return document.querySelector('header.nav') || document.querySelector('header'); }
  function getToggle(){
    const h = getHeader();
    return h ? h.querySelector('.hamburger, .menu-toggle, .nav-toggle, .mobile-toggle, button[aria-label*="menu" i]') : null;
  }
  function getLinks(){
    const h = getHeader();
    return h ? h.querySelector('.nav-links') : null;
  }
  function setOpen(open){
    const h = getHeader();
    const t = getToggle();
    const l = getLinks();
    if(h){
      h.classList.toggle('nav-open', open);
      h.classList.toggle('menu-open', open);
    }
    document.body.classList.toggle('nav-open', open);
    document.body.classList.toggle('mobile-menu-open', open);
    if(t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(l) l.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  function isOpen(){ return document.body.classList.contains('nav-open'); }
  function init(){
    const h = getHeader();
    const t = getToggle();
    const l = getLinks();
    if(!h || !t || !l) return;
    setOpen(false);
    t.onclick = function(e){
      if(window.innerWidth <= 768){
        e.preventDefault();
        e.stopPropagation();
        setOpen(!isOpen());
      }
    };
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
