document.addEventListener("DOMContentLoaded", ()=>{
  const order = loadOrder();
  const $ = (s)=>document.querySelector(s);

  $("#address").value = order.address || "";

  // --- Mapbox setup (requires a token) ---
  // Create a Mapbox token at https://account.mapbox.com/ and paste it here.
  const MAPBOX_TOKEN = "pk.eyJ1IjoiamNhZ2xlMDUxMyIsImEiOiJjbWtlZjZtNTEwNmpjM2ZwdzNncmd4bmtxIn0.77ShM5FPhsnCEu4k3YJoxw";

  // 57 Isle of Palms access points (1st–57th Ave).
  // We geocode them once (cached in localStorage), then push them EAST toward the beach for a more accurate visual placement.
  const ACCESS_NAMES = ["1st Ave Beach Access", "2nd Ave Beach Access", "3rd Ave Beach Access", "4th Ave Beach Access", "5th Ave Beach Access", "6th Ave Beach Access", "7th Ave Beach Access", "8th Ave Beach Access", "9th Ave Beach Access", "10th Ave Beach Access", "11th Ave Beach Access", "12th Ave Beach Access", "13th Ave Beach Access", "14th Ave Beach Access", "15th Ave Beach Access", "16th Ave Beach Access", "17th Ave Beach Access", "18th Ave Beach Access", "19th Ave Beach Access", "20th Ave Beach Access", "21st Ave Beach Access", "22nd Ave Beach Access", "23rd Ave Beach Access", "24th Ave Beach Access", "25th Ave Beach Access", "26th Ave Beach Access", "27th Ave Beach Access", "28th Ave Beach Access", "29th Ave Beach Access", "30th Ave Beach Access", "31st Ave Beach Access", "32nd Ave Beach Access", "33rd Ave Beach Access", "34th Ave Beach Access", "35th Ave Beach Access", "36th Ave Beach Access", "37th Ave Beach Access", "38th Ave Beach Access", "39th Ave Beach Access", "40th Ave Beach Access", "41st Ave Beach Access", "42nd Ave Beach Access", "43rd Ave Beach Access", "44th Ave Beach Access", "45th Ave Beach Access", "46th Ave Beach Access", "47th Ave Beach Access", "48th Ave Beach Access", "49th Ave Beach Access", "50th Ave Beach Access", "51st Ave Beach Access", "52nd Ave Beach Access", "53rd Ave Beach Access", "54th Ave Beach Access", "55th Ave Beach Access", "56th Ave Beach Access", "57th Ave Beach Access"];

  // How far to push points toward the beach (meters). Tune if needed: 200–450m.
  const EAST_PUSH_METERS = 320;

  // Popularity tags (editable)
  const POPULAR = new Set([
    "Front Beach / Ocean Blvd (approx)",
    "Isle of Palms County Park (14th Ave)",
    "1st Ave Beach Access","2nd Ave Beach Access","3rd Ave Beach Access","4th Ave Beach Access","5th Ave Beach Access",
    "10th Ave Beach Access","11th Ave Beach Access","12th Ave Beach Access","13th Ave Beach Access","14th Ave Beach Access",
    "21st Ave Beach Access","25th Ave Beach Access","34th Ave Beach Access","42nd Ave Beach Access","46th Ave Beach Access","52nd Ave Beach Access","57th Ave Beach Access"
  ]);

  // Distance (Haversine)
  function distanceMeters(a, b){
    const R = 6371000;
    const toRad = (x)=>x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
    const h = s1*s1 + Math.cos(lat1)*Math.cos(lat2)*s2*s2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Shift a lat/lng by meters in a bearing direction (90° = east)
  function shiftMeters(lat, lng, bearingDeg, meters){
    const R = 6378137;
    const brng = bearingDeg * Math.PI / 180;
    const dByR = meters / R;

    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dByR) +
                           Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng));

    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1),
                                   Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2));

    return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
  }

  let map = null;
  let markers = [];
  let addressMarker = null;
  let debounceTimer = null;

  function tokenReady(){
    return MAPBOX_TOKEN && !MAPBOX_TOKEN.includes("PASTE_YOUR_MAPBOX_TOKEN_HERE");
  }

  function showTokenMessage(){
    const el = document.getElementById("accessMap");
    el.style.display = "grid";
    el.style.placeItems = "center";
    el.style.padding = "18px";
    el.innerHTML = `
      <div class="notice">
        <b>3D map needs a Mapbox token.</b><br>
        1) Create a token at Mapbox<br>
        2) Open <code>js/order-address.js</code><br>
        3) Replace <code>PASTE_YOUR_MAPBOX_TOKEN_HERE</code><br><br>
        Then refresh and you’ll see the 3D Isle of Palms map with clickable access points.
      </div>
    `;
  }

  async function mapboxGeocode(query){
    if (!tokenReady()) return null;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=US&proximity=-79.772,32.795`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features && data.features[0];
    if (!f || !f.center) return null;
    return { lng: f.center[0], lat: f.center[1] };
  }

  async function loadAccessPoints(){
    // Bump cache key whenever we change point logic so you don't get stale inland points
    const key = "bb_iop_access_points_v2_57";
    try{
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (cached && cached.points && cached.points.length >= 57) return cached.points;
    }catch(e){}

    // If no token, fall back to a few approximate points (limited)
    if (!tokenReady()) return [
      { name:"Isle of Palms County Park (14th Ave)", lng:-79.7865, lat:32.7880 },
      { name:"Front Beach / Ocean Blvd (approx)", lng:-79.787816, lat:32.787356 },
      { name:"42nd Ave Beach Access (approx)", lng:-79.756806, lat:32.79675 },
    ];

    const points = [];

    // Add a couple known anchors (still shifted slightly to shoreline)
    const anchors = [
      { name:"Isle of Palms County Park (14th Ave)", q:"Isle of Palms County Park, Isle of Palms, SC" },
      { name:"Front Beach / Ocean Blvd (approx)", q:"Ocean Blvd, Isle of Palms, SC" },
    ];
    for (const a of anchors){
      const loc = await mapboxGeocode(a.q);
      if (loc){
        const shifted = shiftMeters(loc.lat, loc.lng, 90, EAST_PUSH_METERS);
        points.push({ name:a.name, lng: shifted.lng, lat: shifted.lat });
      }
    }

    // Geocode each access name once, then push east toward the beach
    for (const name of ACCESS_NAMES){
      const q = `${name}, Isle of Palms, SC`;
      const loc = await mapboxGeocode(q);
      if (loc){
        const shifted = shiftMeters(loc.lat, loc.lng, 90, EAST_PUSH_METERS);
        points.push({ name, lng: shifted.lng, lat: shifted.lat });
      }
    }

    try{ localStorage.setItem(key, JSON.stringify({ points, savedAt: Date.now(), eastPushMeters: EAST_PUSH_METERS })); }catch(e){}
    return points;
  }

  function initMap(){
    if (map || !document.getElementById("accessMap")) return;

    if (!tokenReady()){
      showTokenMessage();
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: "accessMap",
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-79.772, 32.795],
      zoom: 12.7,
      pitch: 60,
      bearing: -15,
      antialias: true
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", async () => {
      // 3D buildings (where available)
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(l => l.type === "symbol" && l.layout && l.layout["text-field"])?.id;
      try{
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#aaa",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.55
            }
          },
          labelLayerId
        );
      }catch(e){}

      const pts = await loadAccessPoints();
      order._accessPoints = pts;
      saveOrder(order);
      renderAccessMarkers();
    });
  }

  function clearMarkers(){
    markers.forEach(m => m.remove());
    markers = [];
  }

  function renderAccessMarkers(){
    if (!map) return;
    const pts = order._accessPoints || [];
    if (!pts.length) return;

    clearMarkers();

    pts.forEach(p => {
      const isSelected = order.chosenAccess === p.name;

      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      // Yellow = unselected, Blue = selected
      el.style.background = isSelected ? "rgba(86,156,255,.95)" : "rgba(255,211,122,.95)";
      el.style.border = "2px solid rgba(0,0,0,.25)";
      el.style.boxShadow = "0 10px 18px rgba(0,0,0,.35)";
      el.style.cursor = "pointer";

      const pop = POPULAR.has(p.name) ? "Popular" : "Access point";

      const m = new mapboxgl.Marker(el)
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setHTML(
          `<b>${p.name}</b><br><span style="opacity:.85">${pop}</span><br><span style="opacity:.85">Click to select</span>`
        ))
        .addTo(map);

      el.addEventListener("click", () => {
        order._manualAccess = true; // user picked a different point
        order.chosenAccess = p.name;
        saveOrder(order);
        renderSelectedAndLists();
        renderAccessMarkers();
      });

      markers.push(m);
    });
  }

  function setAddressPin(lngLat){
    if (!map) return;
    if (addressMarker) addressMarker.remove();

    const el = document.createElement("div");
    el.style.width = "12px";
    el.style.height = "12px";
    el.style.borderRadius = "999px";
    // Red = address pin
    el.style.background = "rgba(255,90,106,.95)";
    el.style.border = "2px solid rgba(0,0,0,.25)";
    el.style.boxShadow = "0 10px 18px rgba(0,0,0,.35)";
    addressMarker = new mapboxgl.Marker(el).setLngLat(lngLat).addTo(map);
  }

  function makeBtn(name, sub, selected){
    const item = document.createElement("button");
    item.className = "pay-btn";
    item.type = "button";
    item.innerHTML = `<div><b>${name}</b><div class="muted">${sub || ""}</div></div><div>${selected ? "✓" : "→"}</div>`;
    item.onclick = ()=>{
      order._manualAccess = true; // user picked a different point
      order.chosenAccess = name;
      saveOrder(order);
      renderSelectedAndLists();
      renderAccessMarkers();
    };
    return item;
  }

  function renderSelectedAndLists(){
    $("#selectedBox").innerHTML = `<b>Selected access:</b> ${order.chosenAccess || "—"}<br><span class="muted">Click a marker or pick an option below to change it.</span>`;

    const pts = order._accessPoints || [];

    // Popular list
    const popWrap = $("#popularList");
    popWrap.innerHTML = "";
    const popularNames = Array.from(POPULAR).filter(n => pts.find(p => p.name === n));
    (popularNames.length ? popularNames.slice(0, 12) : pts.slice(0, 12).map(p=>p.name))
      .forEach(n => popWrap.appendChild(makeBtn(n, "Popular", order.chosenAccess === n)));

    // Suggested list
    const sugWrap = $("#suggestions");
    sugWrap.innerHTML = "";
    (order.accessSuggestions || []).forEach(x => {
      sugWrap.appendChild(makeBtn(x.name, x.note, order.chosenAccess === x.name));
    });
  }

  async function autoComputeAccess(){
    const address = ($("#address").value || "").trim();
    order.address = address;
    saveOrder(order);

    if (!requireAddress(order)){
      $("#err").textContent = "";
      $("#resultsWrap").style.display = "none";
      return;
    }

    $("#err").textContent = "";
    $("#resultsWrap").style.display = "block";
    initMap();

    // Instant suggestions (heuristic)
    order.accessSuggestions = buildAccessSuggestionsFromAddress(order.address);

    // Geocode address
    let loc = null;
    if (tokenReady()){
      loc = await mapboxGeocode(order.address + ", Isle of Palms, SC");
    }

    if (loc){
      // Push the ADDRESS pin slightly east too (keeps it near beach side)
      const shiftedAddr = shiftMeters(loc.lat, loc.lng, 90, 80);
      order._addressLoc = shiftedAddr;
      saveOrder(order);

      if (map){
        setAddressPin([shiftedAddr.lng, shiftedAddr.lat]);
        map.flyTo({ center:[shiftedAddr.lng, shiftedAddr.lat], zoom: 13.3, speed: 0.9 });
      }
    }

    // Auto-pick closest ONLY if user has not manually chosen a different access point
    if (!order._manualAccess){
      let chosen = null;

      if (loc){
        const pts = order._accessPoints || (await loadAccessPoints());
        order._accessPoints = pts;

        let best = null;
        let bestD = Infinity;
        const addr = order._addressLoc || loc;
        pts.forEach(p => {
          const d = distanceMeters(addr, {lng:p.lng, lat:p.lat});
          if (d < bestD){ bestD = d; best = p; }
        });
        if (best) chosen = best.name;
      }

      if (!chosen){
        chosen = order.accessSuggestions?.[0]?.name || order.chosenAccess || "";
      }

      order.chosenAccess = chosen;
      saveOrder(order);
    }

    renderSelectedAndLists();
    renderAccessMarkers();
  }

  function debounceAuto(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(()=>{ autoComputeAccess(); }, 450);
  }

  // If they edit the address, we consider it a NEW search -> allow auto-pick again
  $("#address").addEventListener("input", ()=>{
    order._manualAccess = false;
    saveOrder(order);
    debounceAuto();
  });

  $("#backBtn").onclick=()=>location.href="index.html";
  $("#nextBtn").onclick=async ()=>{
    $("#err").textContent = "";

    if (!requireAddress(order)){
      $("#err").textContent = "Enter the beach property address.";
      return;
    }

    // Ensure we have a chosen access point (auto-pick closest unless the user manually picked one)
    await autoComputeAccess();

    if (!order.chosenAccess || !String(order.chosenAccess).trim().length){
      $("#err").textContent = "Please select a beach access point on the map.";
      return;
    }

    // Build a clean note that can be saved in Booqable via a custom checkout field
    const note = `Beach Bums Setup\nAddress: ${order.address}\nAccess point: ${order.chosenAccess}`;
    order.booqableNote = note;
    saveOrder(order);

    // Try to copy note to clipboard so the customer can paste it into a required custom checkout field
    try{
      if (navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(note);
      }
    }catch{ /* ignore */ }

    // Proceed to gear selection
    location.href = "order-gear.html";
  };

  // Restore
  if ((order.address || "").trim().length){
    $("#resultsWrap").style.display = "block";
    initMap();
    autoComputeAccess();
  } else {
    $("#resultsWrap").style.display = "none";
  }
});