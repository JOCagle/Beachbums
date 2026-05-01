// Beach Bums: change Booqable "View Cart" button to "← Keep Shopping"
// and send customers back to the live gear page.
(function () {
  if (window.__BB_KEEP_SHOPPING_FIX__) return;
  window.__BB_KEEP_SHOPPING_FIX__ = true;

  var GEAR_URL = 'https://beachbumsiop.com/order-gear';

  function fixViewCartButton() {
    document.querySelectorAll('a, button, [role="button"]').forEach(function (btn) {
      var text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'view cart') {
        btn.textContent = '← Keep Shopping';
        btn.setAttribute('aria-label', 'Keep shopping');
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = GEAR_URL;
        }, true);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixViewCartButton);
  else fixViewCartButton();

  try {
    new MutationObserver(fixViewCartButton).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {
    setInterval(fixViewCartButton, 800);
  }
})();
