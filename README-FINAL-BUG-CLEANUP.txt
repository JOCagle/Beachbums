Final bug cleanup:
- Prevented the custom mobile Booqable date-sync automation from running on desktop.
- This stops Booqable's date picker from flashing when clicking Checkout on desktop.
- Kept the working mobile date sync intact.
- Cleaned the Keep Shopping button script to use a MutationObserver instead of constantly rebinding every 500ms.
