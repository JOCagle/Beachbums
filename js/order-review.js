document.addEventListener("DOMContentLoaded", () => {
  const order = loadOrder();
  const $ = (s) => document.querySelector(s);

  // Fill summary
  const dates = order.dates && order.dates.start ? `${order.dates.start} → ${order.dates.end}` : "—";
  const address = order.address || "—";
  const accessRaw = order.chosenAccess;
  const access = (typeof accessRaw === 'string')
    ? accessRaw
    : (accessRaw && typeof accessRaw === 'object' && accessRaw.name)
      ? String(accessRaw.name)
      : (accessRaw ? String(accessRaw) : "—");

  $("#summary").innerHTML = `
    <div class="kv"><div><b>Dates</b></div><div>${dates}</div></div>
    <div class="kv"><div><b>Address</b></div><div>${escapeHtml(address)}</div></div>
    <div class="kv"><div><b>Beach access</b></div><div>${escapeHtml(access)}</div></div>
  `;

  // Build delivery note text (what we want stored in Booqable)
  const noteLines = [
    `Address: ${address}`,
    `Beach access: ${access}`,
  ].join("\n");
  $("#deliveryNote").value = noteLines;

  // Store for later (in case user wants it again)
  order.deliveryNote = noteLines;
  saveOrder(order);

  // Copy note helper
  async function copyNote() {
    const txt = $("#deliveryNote").value || "";
    try {
      await navigator.clipboard.writeText(txt);
      $("#copyStatus").textContent = "Copied!";
      setTimeout(() => ($("#copyStatus").textContent = ""), 2000);
    } catch (e) {
      // Fallback
      $("#deliveryNote").select();
      document.execCommand("copy");
      $("#copyStatus").textContent = "Copied!";
      setTimeout(() => ($("#copyStatus").textContent = ""), 2000);
    }
  }

  $("#copyNoteBtn").addEventListener("click", copyNote);

  $("#backBtn").onclick = () => (location.href = "order-gear.html");

  $("#nextBtn").onclick = async () => {
    $("#err").textContent = "";

    // Always copy note before redirecting to checkout (helps ensure it gets into Booqable)
    await copyNote();

    // Try (best-effort) to attach note to the Booqable cart if an API exists.
    try {
      const note = $("#deliveryNote").value || "";
      if (window.Booqable && window.Booqable.cart && typeof window.Booqable.cart.update === "function") {
        await window.Booqable.cart.update({ note });
      } else if (window.Booqable && window.Booqable.Cart && typeof window.Booqable.Cart.update === "function") {
        await window.Booqable.Cart.update({ note });
      }
    } catch (e) {
      // Ignore – clipboard still worked
    }

    if (window.BBCheckout && typeof window.BBCheckout.start === "function") {
      window.BBCheckout.start();
    } else {
      alert(
        "Checkout system not loaded yet.\n\nIf you're testing by double-clicking files (file://), run a local server instead."
      );
    }
  };

  // Basic HTML escape for injected content
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
