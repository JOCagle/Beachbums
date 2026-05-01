// Shared state across all order pages (static-host friendly)
const STATE_KEY = "beachbums_order_v3";
const ORDER_META_KEY = "bb_order_meta_v1";
const CHECKOUT_CAPTURE_PREFIX = "bb_checkout_";
const CHECKOUT_STORAGE_KEYS = [
  "bb_access_point",
  "bb_beach_access",
  "bb_delivery_note",
  "bb_note_ts",
  "bb_order_payload",
  "bb_checkout_session",
  "bb_checkout_session_ts",
  "bb_last_access_update",
  `${CHECKOUT_CAPTURE_PREFIX}name`,
  `${CHECKOUT_CAPTURE_PREFIX}first_name`,
  `${CHECKOUT_CAPTURE_PREFIX}last_name`,
  `${CHECKOUT_CAPTURE_PREFIX}email`,
  `${CHECKOUT_CAPTURE_PREFIX}phone`,
  `${CHECKOUT_CAPTURE_PREFIX}instructions`
];

// Pricing (per day)
const PRICING = {
  chair: 15,
  umbrella: 30,       // table included
  cooler: 50,
  bundle_2c1u: 48,    // 2 chairs + 1 umbrella (table included)
  taxRate: 0.00
};

function defaultOrder(){
  return {
    meta: { sessionId: "", updatedAt: 0 },
    qty: { chairs: 0, umbrellas: 0, coolers: 0 },
    dates: { start: "", end: "" },
    address: "",
    accessSuggestions: [],
    chosenAccess: "",
    customer: { firstName:"", lastName:"", email:"", phone:"" },
    payment: { method: "", status: "unpaid" },
    totals: { days: 0, subtotal: 0, tax: 0, total: 0, bundles: 0, remainingChairs: 0, remainingUmbrellas: 0 },
    orderId: ""
  };
}

function makeSessionId(){
  return `bb-${Date.now()}-${Math.random().toString(16).slice(2,10)}`;
}

function loadMeta(){
  try{
    const raw = localStorage.getItem(ORDER_META_KEY);
    if (!raw) return { sessionId: makeSessionId(), updatedAt: Date.now() };
    const parsed = JSON.parse(raw);
    return {
      sessionId: parsed && parsed.sessionId ? String(parsed.sessionId) : makeSessionId(),
      updatedAt: Number(parsed && parsed.updatedAt) || Date.now()
    };
  }catch{
    return { sessionId: makeSessionId(), updatedAt: Date.now() };
  }
}

function saveMeta(meta){
  try{ localStorage.setItem(ORDER_META_KEY, JSON.stringify(meta)); }catch{}
}

function clearCookie(name){
  try{
    const isLocal = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    let cookie = `${name}=; path=/; max-age=0; SameSite=None`;
    if (location.protocol === "https:") cookie += "; Secure";
    if (!isLocal) cookie += "; domain=.beachbumsiop.com";
    document.cookie = cookie;
  }catch{}
}

function clearCheckoutBridgeState(){
  try{
    CHECKOUT_STORAGE_KEYS.forEach((key)=>{
      try { localStorage.removeItem(key); } catch(e) {}
    });
    ["bb_access_point","bb_beach_access","bb_delivery_note","bb_note_ts","bb_order_payload","bb_checkout_session","bb_checkout_session_ts","bb_last_access_update"].forEach(clearCookie);
  }catch{}
}

function hydrateOrderMeta(order){
  const meta = loadMeta();
  const orderMeta = order && order.meta ? order.meta : {};
  return {
    ...order,
    meta: {
      sessionId: orderMeta.sessionId || meta.sessionId || makeSessionId(),
      updatedAt: Number(orderMeta.updatedAt) || meta.updatedAt || Date.now()
    }
  };
}

function loadOrder(){
  try{
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return hydrateOrderMeta(defaultOrder());
    return hydrateOrderMeta({ ...defaultOrder(), ...JSON.parse(raw) });
  }catch{
    return hydrateOrderMeta(defaultOrder());
  }
}

function saveOrder(order){
  const next = hydrateOrderMeta(order || defaultOrder());
  next.meta.updatedAt = Date.now();
  if (!next.meta.sessionId) next.meta.sessionId = makeSessionId();
  saveMeta(next.meta);
  localStorage.setItem(STATE_KEY, JSON.stringify(next));

  // Persist cookies readable on the checkout subdomain.
  try{
    const isLocal = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    const setCookie = (name, value) => {
      if (value == null) return;
      const encoded = encodeURIComponent(String(value));
      let cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=None`;
      if (location.protocol === "https:") cookie += "; Secure";
      if (!isLocal) cookie += "; domain=.beachbumsiop.com";
      document.cookie = cookie;
    };

    // ── Access point cookies (for Booqable checkout autofill) ──
    const ca = (next && next.chosenAccess) ? next.chosenAccess : null;
    const access = !ca ? "" : (typeof ca === "string" ? ca : (ca.name ? String(ca.name) : ""));
    const accessClean = String(access || "").replace(/\s*\(popular pick\)\s*/ig, "").trim();

    if (accessClean) {
      const note = `Selected access point: ${accessClean}`;
      const stamp = String(Date.now());
      setCookie("bb_delivery_note", note);
      setCookie("bb_access_point", accessClean);
      setCookie("bb_beach_access", accessClean);
      setCookie("bb_note_ts", stamp);
      setCookie("bb_last_access_update", stamp);
      setCookie("bb_checkout_session", next.meta.sessionId);
      setCookie("bb_checkout_session_ts", stamp);
      try{ localStorage.setItem("bb_access_point", accessClean); }catch(e){}
      try{ localStorage.setItem("bb_beach_access", accessClean); }catch(e){}
      try{ localStorage.setItem("bb_delivery_note", note); }catch(e){}
      try{ localStorage.setItem("bb_note_ts", stamp); }catch(e){}
      try{ localStorage.setItem("bb_last_access_update", stamp); }catch(e){}
      try{ localStorage.setItem("bb_checkout_session", next.meta.sessionId); }catch(e){}
      try{ localStorage.setItem("bb_checkout_session_ts", stamp); }catch(e){}
    } else {
      ["bb_access_point","bb_beach_access","bb_delivery_note","bb_note_ts","bb_last_access_update"].forEach(clearCookie);
      ["bb_access_point","bb_beach_access","bb_delivery_note","bb_note_ts","bb_last_access_update"].forEach((key)=>{
        try { localStorage.removeItem(key); } catch(e) {}
      });
    }

    // ── ALWAYS save order payload cookie for Booqable Success Page ──
    const payload = {
      orderId: next.orderId || (typeof makeOrderId === 'function' ? makeOrderId() : 'BB-'+Date.now()),
      meta: next.meta || {},
      dates: next.dates || {},
      customer: next.customer || {},
      address: next.address || "",
      chosenAccess: next.chosenAccess || "",
      qty: next.qty || {},
      totals: next.totals || {},
      payment: next.payment || {},
    };
    setCookie("bb_order_payload", JSON.stringify(payload));
    setCookie("bb_checkout_session", next.meta.sessionId);
    try{ localStorage.setItem("bb_order_payload", JSON.stringify(payload)); }catch(e){}
    // ────────────────────────────────────────────────────────────

  }catch(e){
    // ignore
  }
}

function resetOrder(options){
  const keepSession = options && options.keepSession;
  localStorage.removeItem(STATE_KEY);
  if (!keepSession) {
    try { localStorage.removeItem(ORDER_META_KEY); } catch(e) {}
  }
  clearCheckoutBridgeState();
}

function beginFreshOrder(preserve){
  const current = loadOrder();
  const fresh = defaultOrder();
  if (preserve && preserve.qty) fresh.qty = { ...current.qty };
  if (preserve && preserve.dates) fresh.dates = { ...current.dates };
  fresh.meta = { sessionId: makeSessionId(), updatedAt: Date.now() };
  clearCheckoutBridgeState();
  saveMeta(fresh.meta);
  localStorage.setItem(STATE_KEY, JSON.stringify(fresh));
  return fresh;
}

function makeOrderId(){
  const d = new Date();
  const pad = (n)=>String(n).padStart(2,"0");
  return `BB-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.random().toString(16).slice(2,8).toUpperCase()}`;
}

function calcTotals(order){
  const chairs = Number(order.qty.chairs || 0);
  const umbrellas = Number(order.qty.umbrellas || 0);
  const coolers = Number(order.qty.coolers || 0);
  const days = Number(order.totals.days || 0);

  const bundles = Math.min(Math.floor(chairs / 2), umbrellas);
  const remainingChairs = chairs - (bundles * 2);
  const remainingUmbrellas = umbrellas - bundles;

  const bundleCost = bundles * PRICING.bundle_2c1u * days;
  const chairCost = remainingChairs * PRICING.chair * days;
  const umbrellaCost = remainingUmbrellas * PRICING.umbrella * days;
  const coolerCost = coolers * PRICING.cooler * days;

  const subtotal = bundleCost + chairCost + umbrellaCost + coolerCost;
  const tax = subtotal * (PRICING.taxRate || 0);
  const total = subtotal + tax;

  order.totals = {
    days,
    bundles, remainingChairs, remainingUmbrellas,
    bundleCost, chairCost, umbrellaCost, coolerCost,
    subtotal, tax, total
  };
  return order;
}

// Heuristic access-point suggestions by parsing Avenue number from the address.
// Sources: IOP has many beach access paths; notable public parking/access areas include Front Beach (Ocean Blvd 10th-14th) and parking mentions at 21st & 42nd, plus ADA paths at 34A/46th/52nd.
function buildAccessSuggestionsFromAddress(address){
  const s = (address || "").toLowerCase();

  // Try to find "42nd ave" / "42nd avenue" patterns
  let avenue = null;
  const m = s.match(/\b(\d{1,2})(st|nd|rd|th)\s+(ave|avenue)\b/);
  if (m) avenue = Number(m[1]);

  const suggestions = [];
  // Always include common spots
  suggestions.push({ name: "Front Beach Access (Ocean Blvd between 10th–14th Ave)", note: "Popular area with nearby lots/amenities." });
  suggestions.push({ name: "Isle of Palms County Park", note: "Main public park beach access." });

  if (avenue !== null){
    suggestions.unshift({ name: `Nearest Access: ${avenue}${m[2]} Avenue Beach Access`, note: "Based on your address avenue." });

    // Nearby suggestions (±3)
    const near = [avenue-3, avenue-2, avenue-1, avenue+1, avenue+2, avenue+3].filter(n=>n>=1 && n<=59);
    near.forEach(n=>{
      suggestions.push({ name: `Nearby Access: ${n}${suffix(n)} Avenue`, note: "Nearby option." });
    });

    if (avenue <= 14){
      suggestions.push({ name: "Front Beach Access (Ocean Blvd 10th–14th)", note: "Closest when staying near lower-numbered avenues." });
    } else if (avenue >= 21 && avenue <= 40){
      suggestions.push({ name: "Palm Blvd Access Zone (21st–40th Ave area)", note: "Public road right-of-way parking area." });
    } else if (avenue >= 42 && avenue <= 53){
      suggestions.push({ name: "Palm Blvd Access Zone (42nd–53rd Ave area)", note: "Public road right-of-way parking area." });
    }

    // ADA mentions
    [34,46,52].forEach(n=>{
      suggestions.push({ name: `ADA-Accessible Path: ${n}${suffix(n)} Ave (ADA path)`, note: "ADA-accessible access path (if nearby)." });
    });
  } else {
    suggestions.push({ name: "Tip: Look for the nearest numbered Avenue access path", note: "IOP has access paths throughout the island." });
    [21,25,28,34,42,46,52,57].forEach(n=>{
      suggestions.push({ name: `${n}${suffix(n)} Avenue Access (popular pick)`, note: "Common reference point." });
    });
  }

  // Remove duplicates by name
  const seen = new Set();
  return suggestions.filter(x=>{
    const k = x.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);
}

function suffix(n){
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function requireMinOneItem(order){
  const sum = Number(order.qty.chairs||0)+Number(order.qty.umbrellas||0)+Number(order.qty.coolers||0);
  return sum > 0;
}

function requireDates(order){
  return order.dates.start && order.dates.end && BB.daysBetween(order.dates.start, order.dates.end) > 0;
}

function requireAddress(order){
  return (order.address || "").trim().length > 4;
}

function requireContact(order){
  const c = order.customer || {};
  return (c.firstName||"").trim() && (c.lastName||"").trim() && /^\S+@\S+\.\S+$/.test(c.email||"") && (c.phone||"").trim().length >= 7;
}

function downloadOrderCSV(order){
  if (!order.orderId) order.orderId = makeOrderId();
  calcTotals(order);

  const row = {
    timestamp: new Date().toISOString(),
    firstName: order.customer.firstName,
    lastName: order.customer.lastName,
    email: order.customer.email,
    phone: order.customer.phone,
    address: order.address,
    chosenAccess: order.chosenAccess,
    startDate: order.dates.start,
    endDate: order.dates.end,
    days: order.totals.days,
    chairs: order.qty.chairs,
    umbrellas: order.qty.umbrellas,
    coolers: order.qty.coolers,
    bundles_2c1u: order.totals.bundles,
    total: Number(order.totals.total||0).toFixed(2),
    paymentMethod: order.payment.method,
    paymentStatus: order.payment.status,
    orderId: order.orderId
  };

  const headers = Object.keys(row);
  const values = headers.map(k => `"${String(row[k]).replaceAll('"','""')}"`);
  const csv = headers.join(",") + "\n" + values.join(",") + "\n";

  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "beachbums-orders.csv";
  a.click();
  URL.revokeObjectURL(url);

  saveOrder(order);
}



// Expose a tiny API for all pages to use (loaded before order-*.js files)
window.BeachBumsOrderState = window.BeachBumsOrderState || {
  get: loadOrder,
  set: (patch) => {
    const current = loadOrder();
    const next = { ...current, ...(patch || {}) };
    // Preserve nested objects when patch contains partials
    if (patch && patch.qty) next.qty = { ...current.qty, ...patch.qty };
    if (patch && patch.dates) next.dates = { ...current.dates, ...patch.dates };
    if (patch && patch.customer) next.customer = { ...current.customer, ...patch.customer };
    if (patch && patch.payment) next.payment = { ...current.payment, ...patch.payment };
    if (patch && patch.totals) next.totals = { ...current.totals, ...patch.totals };
    saveOrder(next);
    return next;
  },
  reset: resetOrder,
  beginFresh: beginFreshOrder,
  clearCheckoutBridgeState,
};


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
