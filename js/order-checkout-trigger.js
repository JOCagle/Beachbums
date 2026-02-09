(function(){
  // Creates a real Booqable checkout session by clicking the actual checkout button
  // inside the embedded cart. This avoids relying on any unstable /cart or /checkout URLs.
  function findCheckoutButton(){
    const selectors = [
      'a[href*="/checkouts/"]',
      'a[href*="checkouts"]',
      'button[type="submit"][data-checkout]',
      'button[data-checkout]',
      'button:contains("Checkout")' // note: :contains not supported; kept as doc
    ];
    // Common Booqable cart drawer buttons often have data-testid attributes
    const testid = [
      '[data-testid="cart-checkout"]',
      '[data-testid="checkout"]',
      '[data-testid="cart-footer-checkout"]'
    ];
    for (const s of testid){
      const el = document.querySelector(s);
      if (el) return el;
    }
    // fallback: find visible buttons/links that say Checkout
    const btns = Array.from(document.querySelectorAll('a,button'));
    for (const el of btns){
      const txt = (el.textContent||'').trim().toLowerCase();
      if (txt === 'checkout' || txt.includes('checkout')){
        return el;
      }
    }
    return null;
  }

  function openCartIfNeeded(){
    // Try to open cart drawer if theme uses an icon/button
    const candidates = [
      '[data-testid="cart-toggle"]',
      'button[aria-label*="cart" i]',
      'a[aria-label*="cart" i]',
      '.booqable-cart-toggle',
      '.cart-toggle',
      'a[href*="cart"]'
    ];
    for (const s of candidates){
      const el = document.querySelector(s);
      if (el){
        try{ el.click(); }catch{}
        return true;
      }
    }
    return false;
  }

  function waitFor(fn, {timeout=8000, interval=100}={}){
    return new Promise((resolve,reject)=>{
      const start = Date.now();
      const t = setInterval(()=>{
        const val = fn();
        if (val){
          clearInterval(t); resolve(val); return;
        }
        if (Date.now()-start > timeout){
          clearInterval(t); reject(new Error("timeout")); return;
        }
      }, interval);
    });
  }

  async function start(){
    // Allow checkout through lock (if present)
    document.body.dataset.allowCheckout = "true";

    // ensure cart component exists on page (hidden div included in HTML)
    // Some installs render drawer only after interaction; try opening cart
    openCartIfNeeded();

    let btn = null;
    try{
      btn = await waitFor(findCheckoutButton, {timeout: 10000, interval: 150});
    }catch(e){
      alert("Could not find Booqable checkout button on this page.\n\nMake sure Booqable cart is loaded and you have at least 1 item selected.");
      return;
    }

    try{
      btn.click();
    }catch(e){
      window.location.href = btn.getAttribute('href') || '#';
    }
  }

  window.BBCheckout = { start };
})();