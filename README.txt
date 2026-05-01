Beach Bums V28 - Selected access point -> Booqable field

1) On your MAP page (or the page with the "Next: Pick Gear" / checkout button):
   - Upload /js/bb-checkout-bridge.js to your site.
   - Make sure your map code sets: window.selectedAccessPoint = "<name>" whenever a point is selected.
   - Set your button to call: goToCheckout()

   Example:
     <script src="js/bb-checkout-bridge.js"></script>
     <button onclick="goToCheckout()">Next</button>

   If your checkout URL is different, set BEFORE calling goToCheckout():
     window.BB_CHECKOUT_URL = "https://checkout.beachbumsiop.com/checkout";

2) In Booqable (Checkout -> Custom code -> Footer):
   - Paste the contents of: booqable_checkout_footer_snippet.html
   This will auto-fill your new checkout field labeled exactly:
     "Selected access point"

Notes:
- The bridge stores BOTH:
    bb_access_point (clean value)
    bb_delivery_note (prefixed note)
  and also passes both as URL params as a backup.
- Works in private browsing because URL param is always present.
