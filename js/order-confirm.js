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

  $("#download").onclick=()=>downloadOrderCSV(order);
  $("#startOver").onclick=()=>{ resetOrder(); location.href="order-gear.html"; };
});
