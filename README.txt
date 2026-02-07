Beach Bums Static Website (V2 - multi-page order flow)

Order flow pages:
- order-gear.html
- order-dates.html
- order-address.html
- order-contact.html
- order-review.html
- order-confirm.html

Replace placeholders in /assets:
- logo.webp
- hero.mp4
- gear.jpg

Notes:
- Access point suggestions are heuristic (based on avenue number in address).
- Payment buttons are demo. Real Stripe/PayPal requires a backend.
- CSV export works on any static host and can be appended into your master spreadsheet.



Map note:
- The address page includes a 3D Mapbox map. Add your Mapbox token in js/order-address.js (MAPBOX_TOKEN).


Address page auto-selects closest access using Mapbox Geocoding (requires Mapbox token).


Address page map: includes 41 Isle of Palms access points (3rd–43rd Ave). They are geocoded via Mapbox once and cached in your browser.


Update v7:
- Map includes 57 access points (1st–57th Ave). Points are geocoded then pushed east for better shoreline placement.
- Auto-select closest runs until the user manually chooses an access point; manual choice is respected.


Homepage video:
- Now using Vimeo background iframe. You no longer need assets/hero.mp4.

Backend email (Netlify Functions + SendGrid)
- Each completed order is emailed to connor@beachbumsiop.com.
- Deploy to Netlify and set environment variables:
  - SENDGRID_API_KEY
  - ORDER_FROM_EMAIL (must be verified in SendGrid)
  - ORDER_TO_EMAIL (optional, defaults to connor@beachbumsiop.com)



=== BOOQABLE INTEGRATION NOTES (Added) ===

This build now supports the flow:

1) order-gear.html: Customer adds gear via Booqable embeds

2) order-address.html: Customer chooses beach access + enters address

3) Redirect to Booqable checkout for dates + payment

SETUP:

A) In Booqable: Settings → Online Reservations → Website integration → Other websites
   Copy the JavaScript Snippet and paste it near </body> on:
   - order-gear.html
   - order-address.html
   (and any other page where you want the cart icon to appear)

B) In this site: edit js/booqable-config.js
   Set checkoutUrl to your client's real checkout URL.

C) Products on gear page:
   The page uses <div class="booqable-product-list">.
   In Booqable, add tags/collections like chairs/umbrellas/coolers and filter using data-tags or data-collections.

D) Access + address data:
   The map page stores a formatted note in localStorage as order.booqableNote and tries to copy it to clipboard.
   If you want Booqable to store this automatically, add a required custom checkout field in Booqable (Order field)
   like 'Beach access & address' so customers can paste it into checkout.
