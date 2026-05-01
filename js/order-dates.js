document.addEventListener("DOMContentLoaded", ()=>{
  const order = loadOrder();
  const $ = (s)=>document.querySelector(s);

  function applyAndRender(){
    const days = (order.dates.start && order.dates.end) ? BB.daysBetween(order.dates.start, order.dates.end) : 0;
    order.totals.days = Math.max(0, days);
    calcTotals(order);
    saveOrder(order);

    $("#daysLabel").textContent = order.totals.days ? `${order.totals.days} day(s)` : "Select dates to calculate";
    $("#totalBig").textContent = BB.formatMoney(order.totals.total || 0);
  }

  const initial = [];
  if (order.dates.start) initial.push(order.dates.start);
  if (order.dates.end) initial.push(order.dates.end);

  flatpickr("#dateRange", {
    mode: "range",
    minDate: BB.todayISO(),
    dateFormat: "Y-m-d",
    defaultDate: initial.length ? initial : null,
    showMonths: window.innerWidth < 760 ? 1 : 2,
    onChange: (selectedDates, dateStr, instance) => {
      const s = selectedDates[0] ? instance.formatDate(selectedDates[0], "Y-m-d") : "";
      const e = selectedDates[1] ? instance.formatDate(selectedDates[1], "Y-m-d") : "";
      order.dates.start = s;
      order.dates.end = e;
      applyAndRender();
    }
  });

  $("#backBtn").onclick=()=>location.href="order-gear.html";
  $("#nextBtn").onclick=()=>{
    const ok = requireDates(order);
    $("#err").textContent = ok ? "" : "Select a valid start and end date.";
    if (ok){
      saveOrder(order);
      location.href="order-address.html";
    }
  };

  applyAndRender();
});