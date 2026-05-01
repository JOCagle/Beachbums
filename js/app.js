window.BB = window.BB || {};

BB.formatMoney = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

BB.daysBetween = (startISO, endISO) => {
  const s = new Date(startISO + "T00:00:00");
  const e = new Date(endISO + "T00:00:00");
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? diff : 0;
};

BB.todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Hamburger Menu Logic
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.querySelector(".mobile-toggle");
  const navContainer = document.querySelector(".nav");

  if (toggleBtn && navContainer) {
    toggleBtn.addEventListener("click", () => {
      navContainer.classList.toggle("nav-open");
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.querySelector(".nav");
  const navLinks = document.querySelectorAll(".nav-links a, .nav-cta a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (navContainer) navContainer.classList.remove("nav-open");
    });
  });
});

// Floating sunlight background: gentle mouse/touch reactivity
(() => {
  const root = document.documentElement;
  let targetX = 50, targetY = 28, currentX = 50, currentY = 28;
  const setTarget = (clientX, clientY) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    targetX = Math.max(18, Math.min(82, (clientX / w) * 100));
    targetY = Math.max(12, Math.min(72, (clientY / h) * 100));
  };
  window.addEventListener("pointermove", (e) => setTarget(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (t) setTarget(t.clientX, t.clientY);
  }, { passive: true });
  const animate = () => {
    currentX += (targetX - currentX) * 0.045;
    currentY += (targetY - currentY) * 0.045;
    root.style.setProperty("--bb-mx", `${currentX.toFixed(2)}%`);
    root.style.setProperty("--bb-my", `${currentY.toFixed(2)}%`);
    requestAnimationFrame(animate);
  };
  animate();
})();

// V2 animated beach background: visible moving wave lines + reactive drift
(() => {
  const buildMotionBg = () => {
    if (document.querySelector('.bb-motion-bg')) return;
    const bg = document.createElement('div');
    bg.className = 'bb-motion-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = `
      <div class="bb-motion-bg__sun"></div>
      <div class="bb-motion-bg__ribbons"></div>
      <div class="bb-motion-bg__lines"></div>
      <div class="bb-motion-bg__lines2"></div>
      <div class="bb-motion-bg__sparkle"></div>
    `;
    document.body.prepend(bg);
  };

  const root = document.documentElement;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  const setDrift = (clientX, clientY) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    tx = ((clientX / w) - 0.5) * 34;
    ty = ((clientY / h) - 0.5) * 24;
  };
  window.addEventListener('pointermove', (e) => setDrift(e.clientX, e.clientY), { passive:true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches && e.touches[0];
    if (t) setDrift(t.clientX, t.clientY);
  }, { passive:true });

  const animate = () => {
    cx += (tx - cx) * 0.05;
    cy += (ty - cy) * 0.05;
    root.style.setProperty('--bb-line-x', `${cx.toFixed(1)}px`);
    root.style.setProperty('--bb-line-y', `${cy.toFixed(1)}px`);
    requestAnimationFrame(animate);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildMotionBg, { once:true });
  } else {
    buildMotionBg();
  }
  animate();
})();
