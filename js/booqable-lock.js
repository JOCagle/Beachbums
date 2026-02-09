const BB_ALLOW_CHECKOUT = () =>
  document.body && document.body.dataset && document.body.dataset.allowCheckout === "true";

<<<<<<< HEAD
const BB_CHECKOUT_HOST = (window.BOOQABLE_CONFIG && window.BOOQABLE_CONFIG.checkoutHost) || "checkout.beachbumsiop.com";

function bbRewriteToCheckoutHost(href){
  try{
    if(!href) return href;
    // Only rewrite absolute links to the main domain cart/checkout paths.
    const patterns = [
      /^https?:\/\/(www\.)?beachbumsiop\.com\/(carts|cart|checkouts|checkout)\b/i
    ];
    for(const p of patterns){
      if(p.test(href)){
        const u = new URL(href);
        u.hostname = BB_CHECKOUT_HOST;
        u.protocol = "https:";
        return u.toString();
      }
    }
    return href;
  }catch(e){
    return href;
  }
}

=======
>>>>>>> ce33efc0ed55bfb3c0bca74f5483f881f5094f5e
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
<<<<<<< HEAD
        // Rewrite cart/checkout links to the dedicated checkout subdomain
        const rawHref = el.getAttribute("href");
        const fixedHref = bbRewriteToCheckoutHost(rawHref);
        if (rawHref && fixedHref && rawHref !== fixedHref) {
          el.setAttribute("href", fixedHref);
        }
=======
>>>>>>> ce33efc0ed55bfb3c0bca74f5483f881f5094f5e
        if (unlocked) unlockElement(el);
        else lockElement(el);
      }
    });
  }

  apply();
  const obs = new MutationObserver(() => apply());
  obs.observe(document.documentElement, { subtree: true, childList: true });
})();
