document.addEventListener("DOMContentLoaded", ()=>{
  const order = loadOrder();
  const el = document.querySelector("#orderSummary");
  if (!el) return;

  const gear = [];
  if (order.items?.chairs) gear.push(`<li><b>Chairs:</b> ${order.items.chairs}</li>`);
  if (order.items?.umbrellas) gear.push(`<li><b>Umbrellas (table included):</b> ${order.items.umbrellas}</li>`);
  if (order.items?.coolers) gear.push(`<li><b>Coolers:</b> ${order.items.coolers}</li>`);
  if (order.items?.bundles) gear.push(`<li><b>Bundles (2 chairs + 1 umbrella):</b> ${order.items.bundles}</li>`);

  const days = order.totals?.days || (order.dates?.start && order.dates?.end ? BB.daysBetween(order.dates.start, order.dates.end) : 0);

  el.innerHTML = `
    <div class="grid" style="gap:12px;">
      <div class="card" style="grid-column: span 6;">
        <h4 style="margin:0 0 8px;">Rental</h4>
        <div class="muted"><b>Dates:</b> ${order.dates?.start || "—"} to ${order.dates?.end || "—"}</div>
        <div class="muted"><b>Length:</b> ${days ? `${days} day(s)` : "—"}</div>
        <div class="hr"></div>
        <h4 style="margin:0 0 8px;">Gear</h4>
        <ul class="bullets">${gear.join("") || "<li>—</li>"}</ul>
      </div>

      <div class="card" style="grid-column: span 6;">
        <h4 style="margin:0 0 8px;">Location</h4>
        <div class="muted"><b>Address:</b> ${order.address || "—"}</div>
        <div class="muted"><b>Beach access:</b> ${order.chosenAccess || "—"}</div>
        <div class="hr"></div>
        <h4 style="margin:0 0 8px;">Contact</h4>
        <div class="muted"><b>Name:</b> ${(order.contact?.first||"")} ${(order.contact?.last||"")}</div>
        <div class="muted"><b>Email:</b> ${order.contact?.email || "—"}</div>
        <div class="muted"><b>Phone:</b> ${order.contact?.phone || "—"}</div>
      </div>

      <div class="card" style="grid-column: span 12;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div>
            <div class="muted">Order total</div>
            <div style="font-size:1.6rem; font-weight:900;">${BB.formatMoney(order.totals?.total || 0)}</div>
          </div>
          <div class="muted" style="max-width:540px;">If anything looks off, text/call <b>843‑754‑0102</b>.</div>
        </div>
      </div>
    </div>
  `;
});
