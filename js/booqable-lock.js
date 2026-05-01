const BB_ALLOW_CHECKOUT = () =>
  document.body && document.body.dataset && document.body.dataset.allowCheckout === "true";

const BB_CHECKOUT_HOST = (window.BOOQABLE_CONFIG && window.BOOQABLE_CONFIG.checkoutHost) || "checkout.beachbumsiop.com";


const BB_STATE_KEY = "beachbums_order_v3";

function bbGetChosenAccess(){
  try{
    const raw = localStorage.getItem(BB_STATE_KEY);
    if(!raw) return "";
    const data = JSON.parse(raw);
    if(!data) return "";
    // chosenAccess may be stored as a string (older) or an object {name, ...} (newer)
    const ca = data.chosenAccess;
    if(!ca) return "";
    if(typeof ca === "string") return ca;
    if(typeof ca === "object" && ca.name) return String(ca.name);
    return String(ca);
  }catch(e){
    return "";
  }
}

function bbGetDeliveryNote(){
  try{
    const raw = localStorage.getItem(BB_STATE_KEY);
    if(!raw) return "";
    const data = JSON.parse(raw);
    // Prefer explicit deliveryNote (review page), fall back to specialInstructions (address/map page)
    const note = (data && (data.deliveryNote || data.specialInstructions)) ? String(data.deliveryNote || data.specialInstructions) : "";
    return note;
  }catch(e){
    return "";
  }
}

function bbMaybeAppendBeachAccess(u){
  try{
    const accessRaw = bbGetChosenAccess().trim();
    const noteRaw = bbGetDeliveryNote().trim();

    const access = String(accessRaw).replace(/\s*\(popular pick\)\s*/ig, "").trim();
    const note = String(noteRaw).replace(/\s*\(popular pick\)\s*/ig, "").trim();

    // Build a default note from the access point if no explicit note was provided
    const effectiveNote = note || (access ? `Selected access point: ${access}` : "");

    // Only append to checkout session URLs
    const p = (u.pathname || "").toLowerCase();
    const isCheckout = p.includes("/checkouts/") || p === "/checkout" || p.startsWith("/checkout/");
    if(!isCheckout) return u;

    if(access) u.searchParams.set("beach_access", access);

    // Also pass a prefill-friendly note value (for use with Booqable checkout scripts)
    // We use a custom param name so it won't conflict with Booqable internals.
    if(effectiveNote){
      // Keep it reasonably small to avoid URL limits.
      const clipped2 = effectiveNote.length > 1200 ? effectiveNote.slice(0, 1200) : effectiveNote;
      u.searchParams.set("bb_delivery_note", clipped2);
      u.searchParams.set("bb_note_ts", String(Date.now()));
    }
    return u;
  }catch(e){
    return u;
  }
}

function bbRewriteToCheckoutHost(href){
  try{
    if(!href) return href;

    // Support relative URLs too
    const base = window.location.origin;
    const u = new URL(href, base);

    // Rewrite absolute links from the main domain to the checkout subdomain for cart/checkout paths
    const host = (u.hostname || "").toLowerCase();
    const path = (u.pathname || "").toLowerCase();
    const isCartOrCheckoutPath = path.startsWith("/carts") || path.startsWith("/cart") || path.startsWith("/checkouts") || path.startsWith("/checkout");

    if (isCartOrCheckoutPath && (host === "beachbumsiop.com" || host === "www.beachbumsiop.com")) {
      u.hostname = BB_CHECKOUT_HOST;
      u.protocol = "https:";
    }

    // Append beach_access to checkout session links if available
    bbMaybeAppendBeachAccess(u);

    // If original href was relative, return relative? We keep absolute to avoid issues in embeds.
    return u.toString();
  }catch(e){
    return href;
  }
}

(function () {
  const LOCK_ATTR = "data-bb-locked";

  function lockElement(el) {
    if (el.getAttribute(LOCK_ATTR) === "true") return;
    el.setAttribute(LOCK_ATTR, "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.35";
    el.style.filter = "grayscale(1)";
    el.setAttribute("aria-disabled", "true");
  }

  function unlockElement(el) {
    if (el.getAttribute(LOCK_ATTR) !== "true") return;
    el.removeAttribute(LOCK_ATTR);
    el.style.pointerEvents = "";
    el.style.opacity = "";
    el.style.filter = "";
    el.removeAttribute("aria-disabled");
  }

  function apply() {
    const unlocked = BB_ALLOW_CHECKOUT();

    // Candidates inside injected cart UI
    const elements = Array.from(document.querySelectorAll("a,button"));

    elements.forEach((el) => {
      const txt = (el.textContent || "").trim().toLowerCase();
      const href = (el.getAttribute("href") || "").toLowerCase();

      const looksLikeCheckout =
        txt === "checkout" ||
        txt.includes("checkout") ||
        href.includes("/checkouts") ||
        href.includes("/checkout");

      const looksLikeViewCart =
        txt === "view cart" || href.includes("/cart");

      if (looksLikeCheckout || looksLikeViewCart) {
        // Rewrite cart/checkout links to the dedicated checkout subdomain
        const rawHref = el.getAttribute("href");
        const fixedHref = bbRewriteToCheckoutHost(rawHref);
        if (rawHref && fixedHref && rawHref !== fixedHref) {
          el.setAttribute("href", fixedHref);
        }
        if (unlocked) unlockElement(el);
        else lockElement(el);
      }
    });
  }

  apply();
  const obs = new MutationObserver(() => apply());
  obs.observe(document.documentElement, { subtree: true, childList: true });
  // Patch navigation APIs so any JS-triggered redirect to a checkout session also carries beach_access.
  try{
    const _assign = window.location.assign.bind(window.location);
    window.location.assign = function(url){
      return _assign(bbRewriteToCheckoutHost(url));
    };
  }catch(e){}
  try{
    const _replace = window.location.replace.bind(window.location);
    window.location.replace = function(url){
      return _replace(bbRewriteToCheckoutHost(url));
    };
  }catch(e){}

})();


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
