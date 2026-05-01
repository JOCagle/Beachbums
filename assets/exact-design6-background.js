
/* =========================================================
   EXACT DESIGN 6 - COASTAL INSPIRED BACKGROUND
   From attached 06-coastal-inspired HTML.
   ========================================================= */
(function(){
  const oldCanvases = document.querySelectorAll('#luxuryCoastalBg, #waveCanvas, #animatedBackground, #animated-bg, canvas[data-bg="old"]');
  oldCanvases.forEach(el => el.remove());

  let canvas = document.getElementById('bgCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'bgCanvas';
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d');

  window.DESIGN_CONFIG = {
    "gradient": [[0, "#061724"], [0.5, "#0b4058"], [1, "#0b7283"]],
    "horizon": false,
    "shimmer": true,
    "shimmerAlpha": 0.16,
    "time": 0.011,
    "orbs": [
      {"x": 0.21, "y": 0.27, "r": 280, "a": 0.18, "s": 0.22, "dx": 18, "dy": 18},
      {"x": 0.82, "y": 0.56, "r": 360, "a": 0.13, "s": 0.18, "dx": 28, "dy": 20}
    ],
    "waves": [
      {"y": 0.35, "amp": 20, "freq": 0.013, "speed": 0.75, "drift": 9, "color": "rgba(255,255,255,ALPHA)", "width": 1, "alpha": 0.25},
      {"y": 0.45, "amp": 30, "freq": 0.011, "speed": 0.64, "drift": 12, "color": "rgba(126,225,244,ALPHA)", "width": 1.1, "alpha": 0.27},
      {"y": 0.56, "amp": 28, "freq": 0.01, "speed": 0.53, "drift": 15, "color": "rgba(255,238,184,ALPHA)", "width": 0.9, "alpha": 0.17},
      {"y": 0.67, "amp": 24, "freq": 0.012, "speed": 0.7, "drift": 10, "color": "rgba(255,255,255,ALPHA)", "width": 0.8, "alpha": 0.14}
    ]
  };

  const cfg = window.DESIGN_CONFIG;

  let w = 0;
  let h = 0;
  let t = 0;
  let mx = 0;
  let my = 0;

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', function(e){
    mx = (e.clientX / Math.max(w,1)) - 0.5;
    my = (e.clientY / Math.max(h,1)) - 0.5;
  });

  resize();

  function drawGradient(){
    const g = ctx.createLinearGradient(0,0,w,h);
    cfg.gradient.forEach(function(stop){
      g.addColorStop(stop[0], stop[1]);
    });
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }

  function drawOrb(x,y,r,a){
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, 'rgba(255,236,182,' + a + ')');
    g.addColorStop(0.35, 'rgba(112,213,230,' + (a * 0.35) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
  }

  function drawWave(wv, index){
    ctx.beginPath();

    for(let x = -80; x <= w + 80; x += 7){
      const y =
        h * wv.y +
        Math.sin(x * wv.freq + t * wv.speed + index) * wv.amp +
        Math.sin(x * wv.freq * 0.42 + t * wv.speed * 0.55 + index * 1.7) * wv.amp * 0.42 +
        mx * wv.drift +
        my * wv.drift * 0.7;

      if(x === -80) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }

    ctx.strokeStyle = wv.color.replace('ALPHA', wv.alpha);
    ctx.lineWidth = wv.width;
    ctx.stroke();
  }

  function drawShimmer(){
    ctx.save();
    ctx.globalAlpha = cfg.shimmerAlpha || 0.14;
    for(let i=0; i<10; i++){
      const x = (w * ((i + 1) / 11)) + Math.sin(t * 0.42 + i) * 42;
      const y = h * 0.16 + Math.cos(t * 0.26 + i) * 26;
      const g = ctx.createLinearGradient(x - 110, y, x + 110, y + h * 0.55);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,244,205,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 120, y, 240, h * 0.75);
    }
    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0,0,w,h);
    drawGradient();

    if(cfg.horizon){
      const hg = ctx.createLinearGradient(0,h*.15,0,h*.82);
      hg.addColorStop(0,'rgba(255,255,255,0)');
      hg.addColorStop(.52,'rgba(255,230,162,.16)');
      hg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0,0,w,h);
    }

    cfg.orbs.forEach(function(o, i){
      drawOrb(
        w * o.x + Math.sin(t * o.s + i) * o.dx + mx * 24,
        h * o.y + Math.cos(t * o.s + i) * o.dy + my * 18,
        o.r,
        o.a
      );
    });

    if(cfg.shimmer) drawShimmer();

    cfg.waves.forEach(drawWave);

    t += cfg.time;
    requestAnimationFrame(draw);
  }

  draw();
})();
