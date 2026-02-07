window.BB = window.BB || {};

BB.formatMoney = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

BB.daysBetween = (startISO, endISO) => {
  const s = new Date(startISO + "T00:00:00");
  const e = new Date(endISO + "T00:00:00");
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? diff : 0;
};

BB.todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

