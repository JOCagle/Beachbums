// Booqable integration config
// This project uses embedded Booqable components (product list, datepicker, cart).
// We DO NOT hardcode /cart or /checkout URLs because this store creates a session-based
// checkout URL like: https://beachbumsiop.com/checkouts/<uuid>
//
// Checkout is started by clicking the embedded cart's Checkout button programmatically
// AFTER the user completes your required steps (map/address → gear → review).
window.BOOQABLE_CONFIG = {
<<<<<<< HEAD
  // Domain to use for Booqable cart/checkout routes (so /carts and /checkouts resolve)
  checkoutHost: "checkout.beachbumsiop.com",
=======
>>>>>>> ce33efc0ed55bfb3c0bca74f5483f881f5094f5e
  // Optional: set if you ever need a fallback redirect.
  // checkoutUrl: ""
};
