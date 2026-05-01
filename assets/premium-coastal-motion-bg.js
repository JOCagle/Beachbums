
/* Premium Coastal Motion Background */
(function(){
  if (document.querySelector('.bb-motion-bg')) return;

  /* Remove previous injected canvas background if present */
  document.querySelectorAll('#bgCanvas, #luxuryCoastalBg').forEach(function(el){
    el.remove();
  });

  const bg = document.createElement('div');
  bg.className = 'bb-motion-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = `
    <div class="bb-orb one"></div>
    <div class="bb-orb two"></div>
    <div class="bb-orb three"></div>
    <div class="bb-shimmer"></div>
    <div class="bb-wave wave-a"></div>
    <div class="bb-wave wave-b"></div>
    <div class="bb-wave wave-c"></div>
  `;
  document.body.prepend(bg);

  let tx = 0, ty = 0, cx = 0, cy = 0;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion) {
    window.addEventListener('mousemove', function(e){
      tx = (e.clientX / window.innerWidth - 0.5) * 14;
      ty = (e.clientY / window.innerHeight - 0.5) * 10;
    }, {passive:true});

    function tick(){
      cx += (tx - cx) * 0.045;
      cy += (ty - cy) * 0.045;
      bg.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      requestAnimationFrame(tick);
    }
    tick();
  }
})();
