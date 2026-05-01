Beach Bums - Beach Access → Booqable Checkout Autofill (Feb 2026)

IMPORTANT: For the Mapbox 3D map to load, open the site via a web server (http://...), NOT file://
- VS Code Live Server OR:
  python -m http.server 5500
  then open: http://localhost:5500/order-address.html

How beach access is passed:
- order-address.html saves the selected access label as order.chosenAccess (e.g. "9th Ave Beach Access")
- When a Booqable checkout session URL (/checkouts/...) is generated, js/booqable-lock.js appends:
    &beach_access=<selected label>
  so the checkout page can auto-select the field.

Booqable side:
- Your custom dropdown field must contain the same labels (you added 1st–57th Ave Beach Access).
- Paste the provided Booqable Additional JavaScript (from ChatGPT) into:
  Settings → Online bookings → Checkout → Additional scripts → Additional JavaScript


=== UPDATED BOOQABLE CHECKOUT SCRIPT (AUTO-FILL SPECIAL INSTRUCTIONS FIELD) ===
Paste this into Booqable > Settings > Online reservations > Checkout scripts > Additional scripts

Booqable.on('page-change', function () {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  const params = new URLSearchParams(window.location.search);

  // Prefer URL param first (most reliable)
  let note = params.get('bb_delivery_note') || '';
  const urlTs = Number(params.get('bb_note_ts') || 0);

  // Fallback to cookie; use whichever is newest
  const cookieNote = getCookie('bb_delivery_note') || '';
  const cookieTs = Number(getCookie('bb_note_ts') || 0);

  if (!note) note = cookieNote;
  else if (cookieNote && cookieTs > urlTs) note = cookieNote;

  if (!note) return;

  // Find the input linked to the custom field label
  const label = Array.from(document.querySelectorAll('label'))
    .find(l => l.textContent.trim().toLowerCase().includes('other beach accesses'));

  if (!label) return;

  const input = document.getElementById(label.getAttribute('for'));
  if (!input) return;

  // Only overwrite if empty OR previously auto-filled
  const wasAuto = input.dataset.bbAutofilled === "1";
  if (input.value && input.value.trim() !== "" && !wasAuto) return;

  input.value = note;
  input.dataset.bbAutofilled = "1";

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
