document.addEventListener("DOMContentLoaded", ()=>{
  const order = loadOrder();
  const $ = (s)=>document.querySelector(s);

  order.totals.days = Math.max(0, BB.daysBetween(order.dates.start, order.dates.end) || 0);
  calcTotals(order);
  if (!order.orderId) order.orderId = makeOrderId();
  saveOrder(order);

  $("#confirm").innerHTML = `
    <div class="kv"><div><b>Order ID</b></div><div>${order.orderId}</div></div>
    <div class="kv"><div><b>Name</b></div><div>${order.customer.firstName} ${order.customer.lastName}</div></div>
    <div class="kv"><div><b>Phone</b></div><div>${order.customer.phone}</div></div>
    <div class="kv"><div><b>Email</b></div><div>${order.customer.email}</div></div>
    <div class="kv"><div><b>Address</b></div><div>${order.address}</div></div>
    <div class="kv"><div><b>Access</b></div><div>${order.chosenAccess||"—"}</div></div>
    <div class="kv"><div><b>Dates</b></div><div>${order.dates.start} → ${order.dates.end} (${order.totals.days} day(s))</div></div>
    <div class="kv"><div><b>Total</b></div><div>${BB.formatMoney(order.totals.total||0)}</div></div>
    <div class="kv"><div><b>Payment</b></div><div>${order.payment.method||"—"} / ${order.payment.status||"unpaid"}</div></div>
  `;

  // ── Save order to Supabase for scheduled printing ──
  saveOrderToDatabase(order);

  $("#download").onclick=()=>downloadOrderCSV(order);
  $("#startOver").onclick=()=>{ resetOrder(); location.href="order-gear.html"; };
});

/**
 * POST the order to the save-order Netlify Function so it gets stored
 * in Supabase. This runs silently in the background — it does not
 * block the confirmation page or affect the user experience.
 */
function saveOrderToDatabase(order) {
  const payload = {
    orderId: order.orderId,
    dates: order.dates,
    customer: order.customer,
    address: order.address,
    chosenAccess: order.chosenAccess,
    qty: order.qty,
    totals: order.totals,
    payment: order.payment,
  };

  fetch("/api/save-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        console.log("Order saved to database:", data.id);
      } else {
        console.warn("Order save warning:", data.error);
      }
    })
    .catch((err) => {
      // Silent fail — order still works, just won't auto-print
      console.warn("Could not save order to database:", err.message);
    });
}
