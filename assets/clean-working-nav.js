
(function(){
  function header(){return document.querySelector('header.nav')||document.querySelector('header');}
  function links(){var h=header();return h?h.querySelector('.nav-links'):null;}
  function toggle(){var h=header();return h?h.querySelector('.hamburger,.menu-toggle,.nav-toggle,.mobile-toggle,button[aria-label*="menu" i]'):null;}
  function setOpen(open){
    var h=header(),l=links(),t=toggle();
    if(h){h.classList.toggle('nav-open',open);h.classList.toggle('menu-open',open);}
    document.body.classList.toggle('nav-open',open);
    document.body.classList.toggle('mobile-menu-open',open);
    if(l){l.setAttribute('aria-hidden',open?'false':'true');}
    if(t){t.setAttribute('aria-expanded',open?'true':'false');}
  }
  function isOpen(){return document.body.classList.contains('nav-open');}
  function init(){
    var h=header(),l=links(),t=toggle();
    if(!h||!l||!t)return;
    setOpen(false);
    t.addEventListener('click',function(e){
      if(window.innerWidth<=768){e.preventDefault();e.stopPropagation();setOpen(!isOpen());}
    });
    l.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setOpen(false);});});
    document.addEventListener('click',function(e){if(window.innerWidth<=768&&isOpen()&&h&&!h.contains(e.target)){setOpen(false);}});
    window.addEventListener('resize',function(){if(window.innerWidth>768)setOpen(false);},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
