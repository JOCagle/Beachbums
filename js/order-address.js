/* Beach Bums - Address + Beach Access selection (Mapbox) */
(() => {
  const orderState = window.BeachBumsOrderState;

  // --- CONFIG ---
  const MAPBOX_TOKEN = "pk.eyJ1IjoiamNhZ2xlMDUxMyIsImEiOiJjbWtlZjZtNTEwNmpjM2ZwdzNncmd4bmtxIn0.77ShM5FPhsnCEu4k3YJoxw";
  const TILESET_ID = "jcagle0513.cmlkefqyp0lve1ok643wotmic-0910x"; // <— your tileset (Mapbox Studio > Tilesets)
  const SOURCE_LAYER = "iop_beach_access_points"; // <— vector layer shown in your tileset
  const MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

  // Custom points that should ALWAYS show as yellow dots even if the tileset hasn't been re-published yet.
  // (Example: Coconut Joe's was added in Mapbox Studio and must appear immediately on the website.)
  const CUSTOM_POPULAR_POINTS = [
    { name: "Coconut Joe's", coordinates: [-79.788656, 32.784416] }, // from your Mapbox dataset
    { name: "Palms Hotel", coordinates: [-79.788352, 32.784532] },
    { name: "Seaside Inn", coordinates: [-79.789425, 32.784144] }
  ];

  // Popular access points:
  // - For "Visiting for the day" we keep 3 quick-picks (simple flow).
  // - For "Staying overnight" we show your full Top-20 list as quick-picks (before any address is entered).

  // Popular access points:
  // - For "Visiting for the day" we keep 3 quick-picks (simple flow).
  // - For "Staying overnight" we show your full Top-20 list as quick-picks (before any address is entered).
  //
  // NOTE: We support "display label" (what the user sees) + "query name" (what we look up in the tileset),
  // so minor spelling differences won't break selection.
  // "Visiting for the day" — user selects the exact drop-off/access point (no address needed)
  // Use the same set of options shown in your UI list.
  const POPULAR_DAY_ITEMS = [
    { label: "8th Ave Beach Access", query: "8th Ave Beach Access" },
    { label: "9th Ave Beach Access", query: "9th Ave Beach Access" },
    { label: "Dunescape", query: "Dunescape" },
    { label: "Windjammer", query: "Windjammer" },
    { label: "Seaside Inn", query: "Seaside Inn" },
    { label: "Ocean Palms", query: "Ocean Palms" },
    { label: "1116 Ocean Blvd", query: "1116 Ocean Blvd" },
    { label: "Coconut Joe's", query: "Coconut Joe's" },
    { label: "palms hotel", query: "Palms Hotel" },
    { label: "1140 Ocean Blvd", query: "1140 Ocean Blvd" },
    { label: "Pavilion Drive", query: "Pavilion Drive" },
    { label: "21st Ave Beach Access", query: "21st Ave Beach Access" },
    { label: "23rd Ave Beach Access", query: "23rd Ave Beach Access" },
    { label: "42nd Ave Beach Access", query: "42nd Ave Beach Access" },
    { label: "34A Ave Beach Access", query: "34A Ave Beach Access" },
    { label: "28th Ave Beach Access", query: "28th Ave Beach Access" },
    { label: "25th Ave Beach Access", query: "25th Ave Beach Access" },
    { label: "7th Ave Beach Access", query: "7th Ave Beach Access" },
    { label: "5th Ave Beach Access", query: "5th Ave Beach Access" },
    { label: "50th Ave Beach Access", query: "50th Ave Beach Access" }
  ];

  const POPULAR_OVERNIGHT_ITEMS = [
    { label: "8th Ave Beach Access", query: "8th Ave Beach Access" },
    { label: "9th Ave Beach Access", query: "9th Ave Beach Access" },
    { label: "Dunescape", query: "Dunescape" },
    { label: "Windjammer", query: "Windjammer" },
    { label: "Seaside Inn", query: "Seaside Inn" },
    { label: "Ocean Palms", query: "Ocean Palms" },
    { label: "1116 Ocean Blvd", query: "1116 Ocean Blvd" },
    { label: "Coconut Joe's", query: "Coconut Joe's" },
    { label: "palms hotel", query: "Palms Hotel" },
    { label: "1140 Ocean Blvd", query: "1140 Ocean Blvd" },
    { label: "Pavilion Drive", query: "Pavilion Drive" },
    { label: "21st Ave Beach Access", query: "21st Ave Beach Access" },
    { label: "23rd Ave Beach Access", query: "23rd Ave Beach Access" },
    { label: "42nd Ave Beach Access", query: "42nd Ave Beach Access" },
    { label: "34A Ave Beach Access", query: "34A Ave Beach Access" },
    { label: "28th Ave Beach Access", query: "28th Ave Beach Access" },
    { label: "25th Ave Beach Access", query: "25th Ave Beach Access" },
    { label: "7th Ave Beach Access", query: "7th Ave Beach Access" },
    { label: "5th Ave Beach Access", query: "5th Ave Beach Access" },
    { label: "50th Ave Beach Access", query: "50th Ave Beach Access" }
  ];

  // Names we will match inside the tileset (case-insensitive). This powers the *overnight* map dots.
  // We use the `query` values (not the display labels) so spelling/case differences don't break filtering.
  const POPULAR_OVERNIGHT_MATCH_NAMES = Array.from(
    new Set(
      POPULAR_OVERNIGHT_ITEMS
        .map((x) => (typeof x === "string" ? x : (x.query || x.label)))
        .filter(Boolean)
        .concat([
          // Common variants / punctuation differences
          "Pavilion Drive",
          "Coconut Joe's",
          "Coconut Joes",
          "Coconut Joe’s",
          "Sand Dune Beach Access",
          "Sand Dune Beach Acess",
          "Palms Hotel",
          "palms hotel"
        ])
        .map((s) => String(s))
    )
  );

  function getPopularButtons() {
    return (String(stayType).toLowerCase() === "day")
      ? POPULAR_DAY_ITEMS
      : POPULAR_OVERNIGHT_ITEMS;
  }

  // Names we will match inside the tileset for the DAY flow.
  // Build from the `query` values + common variants.
  const POPULAR_DAY_MATCH_NAMES = Array.from(
    new Set(
      POPULAR_DAY_ITEMS
        .map((x) => (typeof x === "string" ? x : (x.query || x.label)))
        .filter(Boolean)
        .concat([
          // Common variants / punctuation differences
          "Pavilion Drive",
          "Coconut Joe's",
          "Coconut Joes",
          "Coconut Joe’s",
          "Palms Hotel",
          "palms hotel"
        ])
        .map((s) => String(s))
    )
  );

  // --- DOM ---
  const addressInput = document.getElementById("address");
  const nextBtn = document.getElementById("nextBtn");
  const mapEl = document.getElementById("accessMap");
  const selectedBox = document.getElementById("selectedBox");
  const popularSelect = document.getElementById("popularSelect");
  const suggestionList = document.getElementById("suggestions");

  // --- State ---
  const stayType = (() => {
    try { return localStorage.getItem("bb_stay_type") || "overnight"; } catch (e) { return "overnight"; }
  })();

  // UI tweaks for "visiting for the day" flow (no address entry, only 3 main access points)
  if (String(stayType).toLowerCase() === "day") {
    const pageTitle = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");
    const label = document.getElementById("addressLabel");
    const help = document.getElementById("addressHelp");
    const addressBox = document.getElementById("address");
    const addressSection = document.getElementById("addressSection");
    const suggestedTitle = document.getElementById("suggestedTitle");

    document.body.classList.add("is-day-flow");
    document.body.classList.add("has-address-results");
    if (pageTitle) pageTitle.textContent = "Select Your Beach Access";
    if (subtitle) subtitle.textContent = "Tap the map or choose one of the suggested access points below.";
    if (label) label.textContent = "Select a beach access point";
    if (addressBox) addressBox.style.display = "none";
    if (help) help.style.display = "none";
    if (addressSection) {
      addressSection.classList.add("day-flow-actions");
      const field = addressSection.querySelector('.field');
      if (field) field.style.display = 'none';
    }
    if (suggestedTitle && suggestedTitle.closest('.card')) {
      suggestedTitle.closest('.card').style.display = 'none';
    }
  }

  let map;
  let accessCache = null;
  let coastlineModel = null; // fitted line (in meters) from popular access-point dots; used to detect true oceanfront

  // Build a reliable coastline proxy from the Top (overnight) access-point dots.
  // We intentionally use Tilequery lookups (by name) so the model doesn't depend on what tiles
  // happen to be loaded/visible yet.
  let coastlineBuildPromise = null;

  async function ensureCoastlineModel() {
    if (coastlineModel) return coastlineModel;
    if (coastlineBuildPromise) return coastlineBuildPromise;

    coastlineBuildPromise = (async () => {
      try {
        // Only relevant for the overnight flow (Ocean Blvd beachfront homes).
        const names = POPULAR_OVERNIGHT_ITEMS
          .map((x) => (typeof x === "string" ? x : (x.query || x.label)))
          .filter(Boolean);

        const coords = [];
        // Resolve as many named points as possible via Tilequery (network),
        // so we don't depend on current map viewport/tile loading.
        for (const n of names) {
          try {
            const p = await tileQueryFindByName(n);
            if (p?.lngLat) coords.push([p.lngLat.lng, p.lngLat.lat]);
          } catch (e) {
            // fallback to any locally-loaded match
            try {
              const lp = await tileQueryByName(n);
              if (lp?.lngLat) coords.push([lp.lngLat.lng, lp.lngLat.lat]);
            } catch (_) { }
          }
        }

        const model = fitLineModelFromLngLat(coords);
        if (model) coastlineModel = model;
        return coastlineModel;
      } catch (e) {
        return null;
      } finally {
        // allow rebuild if it failed
        if (!coastlineModel) coastlineBuildPromise = null;
      }
    })();

    return coastlineBuildPromise;
  }


  function dedupeKey(lngLat, name) {
    const lng = typeof lngLat.lng === "number" ? lngLat.lng : lngLat[0];
    const lat = typeof lngLat.lat === "number" ? lngLat.lat : lngLat[1];
    return `${lat.toFixed(6)},${lng.toFixed(6)}|${String(name || "").trim()}`;
  }

  function getAccessPointsFromMap() {
    if (!map) return null;
    try {
      // NOTE: source id must match the one used in map.addSource(...)
      const feats = map.querySourceFeatures("accessPts", { sourceLayer: SOURCE_LAYER }) || [];
      const out = [];
      const seen = new Set();
      for (const f of feats) {
        const c = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates : null;
        if (!c || c.length < 2) continue;
        const name = (f.properties && (f.properties.name || f.properties.text || f.properties.title)) || "Access Point";
        const lngLat = { lng: c[0], lat: c[1] };
        const key = dedupeKey(lngLat, name);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name, lngLat });
      }
      return out.length ? out : null;
    } catch (e) {
      // If no access points were found but it's oceanfront, still create a beachfront drop point.
      if (oceanfrontDetected) {
        const displayAddr = (raw && raw.length) ? raw : (String(geo.placeName || "").split(",")[0] || "Oceanfront Address");
        const beachDrop = computeBeachfrontDrop(geo.lngLat, null);
        lastBeachfront = { name: displayAddr, lngLat: beachDrop };
        setBeachfrontDot(beachDrop);
        return {
          name: displayAddr,
          lngLat: beachDrop,
          oceanfrontDetected: true,
          recommendedName: null,
          recommendedLngLat: null
        };
      }

      lastBeachfront = null;
      setBeachfrontDot(null);
      return null;
    }
  }

  function haversineMeters(a, b) {
    const toRad = (x) => x * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function findNearestPoint(points, target) {
    if (!points || !points.length) return null;
    let best = null;
    let bestD = Infinity;
    for (const p of points) {
      const d = haversineMeters(p.lngLat, target);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  let selectedAccess = null; // { name, lngLat }
  let lastAutoSelected = null;
  let lastBeachfront = null; // { name, lngLat } custom sand setup point for oceanfront homes
  // { name, lngLat } from address-based recommendation
  let selectedMarker = null;
  let addressMarker = null;
  let recommendedSourceReady = false;
  let nearbySourceReady = false;
  let customPopularSourceReady = false;
  let beachfrontSourceReady = false;
  let beachfrontSelected = false; // when selected access is the custom beachfront spot


  // --- Helpers ---
  const norm = (s) => String(s || "").trim().toLowerCase();

  // Cookie helpers for checkout (subdomain)
  const COOKIE_DOMAIN = '.beachbumsiop.com';
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
  function isLocalHost() {
    const h = (location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1';
  }
  function setCookieShared(name, value) {
    try {
      const encoded = encodeURIComponent(String(value ?? ''));
      let cookie = `${name}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=None`;
      if (location.protocol === 'https:') cookie += '; Secure';
      if (!isLocalHost()) cookie += `; domain=${COOKIE_DOMAIN}`;
      document.cookie = cookie;
    } catch (_) { }
  }
  function clearCookieShared(name) {
    try {
      let cookie = `${name}=; path=/; max-age=0; SameSite=None`;
      if (location.protocol === 'https:') cookie += '; Secure';
      if (!isLocalHost()) cookie += `; domain=${COOKIE_DOMAIN}`;
      document.cookie = cookie;
    } catch (_) { }
  }

  function setSelected(access) {
    selectedAccess = access;

    const cleanName = (access && access.name)
      ? String(access.name).replace(/\s*\(popular pick\)\s*/ig, "").trim()
      : "";

    // Expose for checkout bridge/scripts
    window.selectedAccessPoint = cleanName;

    const deliveryNote = cleanName ? `Selected access point: ${cleanName}` : "";

    // Keep cookies in sync (and clear stale ones if selection is removed)
    if (cleanName) {
      setCookieShared('bb_access_point', cleanName);
      setCookieShared('bb_beach_access', cleanName);
      setCookieShared('bb_delivery_note', deliveryNote);
      setCookieShared('bb_note_ts', String(Date.now()));
    } else {
      clearCookieShared('bb_access_point');
      clearCookieShared('bb_beach_access');
      clearCookieShared('bb_delivery_note');
      clearCookieShared('bb_note_ts');
    }


    // Oceanfront message (only for Ocean Blvd type selections)
    updateOceanfrontNote(cleanName);
    (function maybeShowOceanfrontPopup(name) {
      if (!name) return;
      // Trigger for oceanfront properties (ex: "800 Ocean Blvd")
      if (!(/\bocean\s*blvd\b/i.test(name) || /\bpalm\s*blvd\b/i.test(name))) return;

      // Exclude known tourist-attraction addresses that should not receive the oceanfront note/modal
      // (User request: do NOT show for 1116 Ocean Blvd or 1140 Ocean Blvd)
      const lowered = String(name).toLowerCase();
      if (/\b1116\s+ocean\s*blvd\b/i.test(lowered) || /\b1140\s+ocean\s*blvd\b/i.test(lowered)) return;

      const key = "bb_oceanfront_popup_shown_" + name.toLowerCase();
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      // Use the nicer modal (defined in order-address.html). Fallback is to do nothing.
      if (typeof window.showOceanfrontModal === "function") {
        window.showOceanfrontModal(name);
      }
    })(cleanName);
    // Show selection in the UI
    if (selectedBox) {
      if (access) {
        const labelEl = document.getElementById("selectedName");
        if (labelEl) {
          labelEl.textContent = cleanName || access.name;
          // keep the rest of the box intact if it's using the default template
          selectedBox.style.display = "";
        } else {
          selectedBox.innerHTML = `<strong>Selected access point:</strong> ${escapeHtml(cleanName || access.name)}`;
        }
      } else {
        const labelEl = document.getElementById("selectedName");
        if (labelEl) {
          labelEl.textContent = "(none yet)";
        } else {
          selectedBox.innerHTML = "";
        }
      }
    }

    // Persist selection immediately so checkout/review always has it.
    try {
      const current = orderState.get();
      orderState.set({
        ...current,
        beachAccess: cleanName || current.beachAccess || "",
        beachAccessType: access?.type || current.beachAccessType || "",
        chosenAccess: access
          ? {
            name: cleanName || access.name,
            type: access.type || "access",
            lng: access.lngLat?.[0],
            lat: access.lngLat?.[1],
          }
          : "",
        specialInstructions: deliveryNote || (current.specialInstructions || ""),
        deliveryNote: deliveryNote || (current.deliveryNote || ""),
      });
    } catch (e) {
      // ignore
    }

    if (selectedMarker) {
      selectedMarker.remove();
      selectedMarker = null;
    }
    if (map && access && access.lngLat) {
      selectedMarker = new mapboxgl.Marker({ color: "#2E7DFF" })
        .setLngLat(access.lngLat)
        .addTo(map);
    }
  }

  function setAddressMarker(lngLat) {
    if (!map) return;
    if (addressMarker) {
      addressMarker.remove();
      addressMarker = null;
    }
    // Distinct marker for the entered address (so it doesn't look like an access point).
    const el = document.createElement("div");
    el.className = "bb-address-marker";
    addressMarker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat(lngLat)
      .addTo(map);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normName(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }


  // ---- Condo handling ----------------------------------------------------
  // Goal:
  // - If user enters a normal home address: never recommend a *condo access point*.
  // - If user enters a condo address / condo complex name: recommend the closest point *within that condo complex*.
  const CONDO_COMPLEXES = [
    { key: "beach_club", patterns: [/\bbeach\s+club\s+villas?\b/i, /\bbeach\s+club\s+villa\b/i] },
    { key: "shipwatch", patterns: [/\bshipwatch\b/i] },
    { key: "mariners_walk", patterns: [/\bmariners\s+walk\b/i] },
    { key: "tidewater", patterns: [/\btidewater\b/i] },
    { key: "summer_house", patterns: [/\bsummer\s+house\b/i] },
    { key: "sea_cabins", patterns: [/\bsea\s+cabins?\b/i] }
  ];

  function condoKeyFromText(text) {
    const s = String(text || "");
    for (const c of CONDO_COMPLEXES) {
      if (c.patterns.some(rx => rx.test(s))) return c.key;
    }
    return null;
  }

  function condoKeyFromPointName(pointName) {
    // Access-point names in your tileset look like:
    // "Beach Club Villa 1 South", "Shipwatch Villas North", "Sea Cabins Building A", etc.
    return condoKeyFromText(pointName);
  }

  // --- Geo helpers (meters / interpolation) ---
  const EARTH_R = 6371000;
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  function distanceMeters(a, b) {
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const dLat = lat2 - lat1;
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function interpolateLngLat(a, b, t) {
    return { lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t };
  }

  // Compute a "setup on the sand" point for oceanfront homes.
  // IMPORTANT: this should stay *adjacent* to the entered address pin.
  // On Isle of Palms, the beach/ocean is generally south of Ocean Blvd properties,
  // so we nudge a small distance toward the ocean to place the dot on/near the sand.
  // We intentionally do NOT march toward a distant access-point (which could drift the dot).
  function computeBeachfrontDrop(houseLngLat /*, nearestBeachLngLat */) {
    const house = { lng: houseLngLat[0], lat: houseLngLat[1] };

    // Nudge ~25m toward the ocean (south). Keeps it next to the red address pin.
    const bearing = toRad(180);
    const dist = 25;
    const lat1 = toRad(house.lat);
    const lng1 = toRad(house.lng);
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dist / EARTH_R) +
      Math.cos(lat1) * Math.sin(dist / EARTH_R) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(dist / EARTH_R) * Math.cos(lat1),
      Math.cos(dist / EARTH_R) - Math.sin(lat1) * Math.sin(lat2)
    );

    return [toDeg(lng2), toDeg(lat2)];
  }

  function setBeachfrontDot(lngLat) {
    try {
      if (map && beachfrontSourceReady) {
        const src = map.getSource("beachfrontPt");
        if (!lngLat) {
          src && src.setData({ type: "FeatureCollection", features: [] });
          return;
        }
        const coords = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
        src && src.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: { kind: "beachfront" },
            geometry: { type: "Point", coordinates: coords }
          }]
        });
      }
    } catch (e) { }
  }

  function showPopularButtons() {
    if (!popularSelect) return;

    const items = getPopularButtons();

    // Rebuild options
    popularSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an access point…";
    placeholder.disabled = true;
    placeholder.selected = true;
    popularSelect.appendChild(placeholder);

    // If we have an address-based recommendation, keep it available (overnight flow only)
    if (String(stayType).toLowerCase() !== "day" && lastAutoSelected?.name) {
      const opt = document.createElement("option");
      opt.value = "__recommended__";
      opt.textContent = `Recommended: ${lastAutoSelected.name}`;
      popularSelect.appendChild(opt);
    }

    // Popular items
    items.forEach((item) => {
      const label = (typeof item === "string") ? item : (item.label || item.query);
      const queryName = (typeof item === "string") ? item : (item.query || item.label);
      const opt = document.createElement("option");
      opt.value = String(queryName || label);
      opt.textContent = label;
      popularSelect.appendChild(opt);
    });

    // Only bind once
    if (!popularSelect.dataset.bound) {
      popularSelect.addEventListener("change", async () => {
        const val = popularSelect.value;
        if (!val) return;

        if (val === "__recommended__" && lastAutoSelected?.lngLat) {
          setSelected({ name: lastAutoSelected.name, lngLat: lastAutoSelected.lngLat });
          map?.flyTo({ center: lastAutoSelected.lngLat, zoom: 16 });
          return;
        }

        const access = await tileQueryByName(val);
        if (access) {
          setSelected(access);
          map?.flyTo({ center: access.lngLat, zoom: 16 });
        } else {
          setSelected({ name: val, lngLat: map?.getCenter() || [-79.75, 32.80] });
        }
      });
      popularSelect.dataset.bound = "1";
    }

    if (suggestionList) {
      suggestionList.innerHTML = (stayType === "day")
        ? `<div class="help">Tip: Select the exact beach access / drop-off you want using the map dots or the dropdown above.</div>`
        : `<div class="help">Tip: Enter your address and we’ll suggest the closest beach access point. You can always switch using the map dots or Popular Options.</div>`;
    }
  }

  // Isle of Palms bounds + proximity hint (keeps searches on the island)
  const IOP_BBOX = [-79.92, 32.74, -79.70, 32.82]; // [minLng, minLat, maxLng, maxLat] approx IOP
  const IOP_PROXIMITY = [-79.75, 32.80]; // [lng, lat] island center

  function looksLikeIOP(placeName) {
    const s = norm(placeName);
    return s.includes("isle of palms") || s.includes("29451");
  }

  function ensureIOPQuery(raw) {
    const s = norm(raw);
    // If user already typed IOP/SC, don't double-append.
    if (s.includes("isle of palms") || s.includes("iop") || s.includes("29451") || s.includes("sc") || s.includes("south carolina")) {
      return raw;
    }
    return `${raw}, Isle of Palms, SC`;
  }

  async function geocodeAddress(query) {
    // Supports BOTH:
    // - street addresses
    // - named places (POIs) like "Harris Teeter", "Ocean Inn", "Coconut Joe's"
    // We bias to Isle of Palms using bbox + proximity, and we accept results inside the bbox
    // even if the place_name string doesn't contain "Isle of Palms".

    const [minLng, minLat, maxLng, maxLat] = IOP_BBOX;
    function inIOPBBox(lngLat) {
      if (!lngLat || lngLat.length < 2) return false;
      const lng = lngLat[0], lat = lngLat[1];
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    }

    function buildParams(types, useBbox = true) {
      let q = `autocomplete=true&limit=5&country=US&types=${encodeURIComponent(types)}` +
        `&proximity=${IOP_PROXIMITY.join(",")}` +
        `&access_token=${MAPBOX_TOKEN}`;
      if (useBbox) q += `&bbox=${IOP_BBOX.join(",")}`;
      return q;
    }

    async function run(q, types, useBbox = true) {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${buildParams(types, useBbox)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Geocoding failed");
      const data = await res.json();

      // Filter out highly inaccurate fuzzy matches (like gibberish returning random streets in SC).
      const feats = (data?.features || []).filter(f => typeof f.relevance === "number" ? f.relevance >= 0.75 : true);
      if (!feats.length) return null;


      // Only accept results that are truly on Isle of Palms as on-island.
      // If Mapbox can't find an IOP match, we return the best match but flag it as off-island.
      const iopNamed = feats.filter(f => looksLikeIOP(f.place_name));
      if (iopNamed.length) {
        const best = iopNamed[0];
        // If the user entered a real street on IOP but NO house number (or just the city name), Mapbox drops a pin in the dead center of the street or city (often near 28th Ave).
        // Since it's not a real, deliverable house, treat it as off-island so it defaults to Pavilion Drive.
        const hasHouseNumber = /^\d+/.test(best.place_name);
        return { placeName: best.place_name, lngLat: best.center, isOffIsland: !hasHouseNumber };
      }

      // If it's in the generous bounding box but lacks an IOP name/zip, it's Mount Pleasant or elsewhere.
      const inBox = feats.filter(f => inIOPBBox(f.center));
      if (inBox.length) {
        const best = inBox[0];
        const hasHouseNumber = /^\d+/.test(best.place_name);
        return { placeName: best.place_name, lngLat: best.center, isOffIsland: !hasHouseNumber || true };
      }

      const best = feats[0];
      const hasHouseNumber = /^\d+/.test(best.place_name);
      return { placeName: best.place_name, lngLat: best.center, isOffIsland: true };
    }

    // Keep track of the best off-island match so we don't lose the user's actual address
    let bestOff = null;

    // 1) Try as an address.
    const first = await run(query, "address");
    if (first) {
      if (!first.isOffIsland) return first;
      if (!bestOff) bestOff = first;
    }

    // 2) Try as a named place/POI. Do not use 'place' feature type because it matches whole cities!
    const poiFirst = await run(query, "poi,neighborhood");
    if (poiFirst) {
      if (!poiFirst.isOffIsland) return poiFirst;
      if (!bestOff) bestOff = poiFirst;
    }

    // 3) Retry by appending ", Isle of Palms, SC" (helps when user types only the business name).
    const fallbackQuery = ensureIOPQuery(query);
    if (fallbackQuery !== query) {
      const second = await run(fallbackQuery, "address");
      if (second && !second.isOffIsland) return second;
      const poiSecond = await run(fallbackQuery, "poi,neighborhood");
      if (poiSecond && !poiSecond.isOffIsland) return poiSecond;
    }

    // 4) Try without Box bounds to allow finding off-island addresses properly
    const offIslandAddress = await run(query, "address", false);
    if (offIslandAddress) {
      if (!bestOff) bestOff = offIslandAddress;
    }

    const offIslandPoi = await run(query, "poi,neighborhood", false);
    if (offIslandPoi) {
      if (!bestOff) bestOff = offIslandPoi;
    }

    if (bestOff) return bestOff;

    // If completely unknown, return null so the Invalid Address modal can trigger.
    return null;
  }

  function metersFromLngLat(lng, lat, refLat) {
    // Equirectangular approximation — good enough at IOP scale
    const x = lng * 111320 * Math.cos((refLat * Math.PI) / 180);
    const y = lat * 110540;
    return { x, y };
  }

  function fitCoastlineModelFromFeatures(features) {
    // Fit a line y = a*x + b in local meters using least squares.
    if (!features || features.length < 2) return null;
    const pts = [];
    let refLat = 0;
    for (const f of features) {
      const c = f?.geometry?.coordinates;
      if (!c || c.length < 2) continue;
      refLat += c[1];
      pts.push(c);
    }
    if (pts.length < 2) return null;
    refLat /= pts.length;

    const XY = pts.map(([lng, lat]) => metersFromLngLat(lng, lat, refLat));
    const n = XY.length;
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    for (const p of XY) {
      sumX += p.x; sumY += p.y;
      sumXX += p.x * p.x;
      sumXY += p.x * p.y;
    }
    const denom = (n * sumXX - sumX * sumX);
    if (Math.abs(denom) < 1e-6) return null;
    const a = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - a * sumX) / n;
    return { a, b, refLat };
  }

  // Same idea as fitCoastlineModelFromFeatures, but takes raw [lng,lat] points.
  function fitLineModelFromLngLat(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    // Build faux features with just geometry.coordinates.
    const feats = coords.map((c) => ({ geometry: { coordinates: c } }));
    return fitCoastlineModelFromFeatures(feats);
  }

  function distanceToCoastlineMeters(lngLat) {
    if (!coastlineModel) return null;
    const { a, b, refLat } = coastlineModel;
    const { x, y } = metersFromLngLat(lngLat[0], lngLat[1], refLat);
    // Distance point->line ax - y + b = 0 (since y = a x + b)
    return Math.abs(a * x - y + b) / Math.sqrt(a * a + 1);
  }

  let palm41CutoffLngCache = null;
  async function getPalm41stCutoffLng() {
    if (typeof palm41CutoffLngCache === "number") return palm41CutoffLngCache;

    const candidates = [
      "41st Ave Beach Access",
      "41st Avenue Beach Access",
      "41st Ave Access",
      "41st Avenue Access"
    ];

    for (const n of candidates) {
      try {
        const ft = await tileQueryFindByName(n);
        const lngLat = ft?.lngLat;
        if (Array.isArray(lngLat) && typeof lngLat[0] === "number") {
          palm41CutoffLngCache = lngLat[0];
          return palm41CutoffLngCache;
        }
      } catch (e) { }
    }

    // If we can't resolve it, leave as null (no cutoff applied)
    palm41CutoffLngCache = null;
    return null;
  }

  async function isOceanfrontAddress(placeName, lngLat) {
    const s = norm(placeName || "");

    // Ocean Blvd: EVEN-numbered parcels = oceanfront
    const onOceanBlvd = s.includes("ocean blvd") || s.includes("ocean boulevard");
    if (onOceanBlvd) {
      const mNum = String(placeName || "").match(/^\s*(\d{1,6})\b/);
      const num = mNum ? parseInt(mNum[1], 10) : NaN;
      if (!Number.isFinite(num)) return false;
      return (num % 2) === 0;
    }

    // Palm Blvd: ONLY EVEN numbers are oceanfront, and STOP classifying oceanfront once you pass 41st Ave.
    const onPalmBlvd = s.includes("palm blvd") || s.includes("palm boulevard");
    if (onPalmBlvd) {
      const mNum = String(placeName || "").match(/^\s*(\d{1,6})\b/);
      const num = mNum ? parseInt(mNum[1], 10) : NaN;
      if (!Number.isFinite(num)) return false;

      // 100–1208 Palm Blvd is NOT beachfront/oceanfront in this flow, even if the street number is even.
      // These addresses should keep acting like regular Palm Blvd addresses and recommend/select nearby access points.
      if (num >= 100 && num <= 1208) return false;

      if ((num % 2) !== 0) return false; // odd = not oceanfront

      if (!Array.isArray(lngLat) || lngLat.length !== 2) return false;

      const cutoffLng = await getPalm41stCutoffLng();
      if (typeof cutoffLng === "number") {
        // West of (or equal to) 41st Ave is allowed; east of 41st is NOT oceanfront for Palm Blvd.
        if (lngLat[0] > cutoffLng) return false;
      }

      return true;
    }

    // Sand Dune Ln: these specific homes are oceanfront (per your property list)
    const onSandDuneLn = s.includes("sand dune ln") || s.includes("sand dune lane");
    if (onSandDuneLn) {
      const mNum = String(placeName || "").match(/^\s*(\d{1,6})\b/);
      const num = mNum ? parseInt(mNum[1], 10) : NaN;
      if (!Number.isFinite(num)) return false;
      return (num >= 5 && num <= 13);
    }


    return false;
  }


  async function tileQueryNearest(lngLat, allowedNames /* array or null */, condoKey /* string|null */) {
    const [lng, lat] = lngLat;
    const url =
      `https://api.mapbox.com/v4/${TILESET_ID}/tilequery/${lng},${lat}.json` +
      `?layers=${encodeURIComponent(SOURCE_LAYER)}` +
      `&limit=50&radius=8000&geometry=point&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tilequery failed: ${res.status}`);
    const data = await res.json();
    const feats = data?.features || [];
    if (!feats.length) return null;


    // Filter condo access points:
    // - if condoKey is set -> ONLY points from that condo complex
    // - else -> EXCLUDE condo points entirely (houses should not be recommended to condos)
    const featsFiltered = (function () {
      if (condoKey) {
        return feats.filter(ft => condoKeyFromPointName(ft?.properties?.name) === condoKey);
      }
      return feats.filter(ft => !condoKeyFromPointName(ft?.properties?.name));
    })();
    if (!featsFiltered.length) return null;


    if (Array.isArray(allowedNames) && allowedNames.length) {
      const allowed = new Set(allowedNames.map(norm));
      const match = featsFiltered.find(ft => allowed.has(norm(ft?.properties?.name)));
      if (match) {
        return { name: match.properties.name, lngLat: match.geometry.coordinates };
      }
      // fallback: none matched
      return null;
    }

    const ft = featsFiltered[0];
    return { name: ft.properties.name, lngLat: ft.geometry.coordinates };
  }

  async function tileQueryNearby(lngLat, radiusMeters = 1800, limit = 12) {
    const [lng, lat] = lngLat;
    const url =
      `https://api.mapbox.com/v4/${TILESET_ID}/tilequery/${lng},${lat}.json` +
      `?layers=${encodeURIComponent(SOURCE_LAYER)}` +
      `&limit=${encodeURIComponent(String(limit))}` +
      `&radius=${encodeURIComponent(String(radiusMeters))}` +
      `&geometry=point&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tilequery failed: ${res.status}`);
    const data = await res.json();
    const feats = data?.features || [];
    return feats
      .filter(ft => ft?.geometry?.coordinates && ft?.properties?.name)
      .map(ft => ({ name: ft.properties.name, lngLat: ft.geometry.coordinates }));
  }

  function setNearbyDots(points /* [{name,lngLat}] */) {
    try {
      if (!map || !nearbySourceReady) return;
      const src = map.getSource("nearbyPts");
      if (!src) return;
      const features = (points || []).map(p => ({
        type: "Feature",
        properties: { name: p.name },
        geometry: { type: "Point", coordinates: p.lngLat }
      }));
      src.setData({ type: "FeatureCollection", features });
    } catch (e) {
      console.warn("nearby dots update failed", e);
    }
  }


  async function tileQueryFindByName(name) {
    const center = [-79.745, 32.80];
    const url =
      `https://api.mapbox.com/v4/${TILESET_ID}/tilequery/${center[0]},${center[1]}.json` +
      `?layers=${encodeURIComponent(SOURCE_LAYER)}` +
      `&limit=200&radius=12000&geometry=point&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tilequery failed: ${res.status}`);
    const data = await res.json();
    const feats = data?.features || [];
    if (!feats.length) return null;

    const wanted = normName(name);

    // 1. Check bypass list first for instant resolution (crucial for unpublished points like Coconut Joe's and Pavilion Drive)
    const customMatch = CUSTOM_POPULAR_POINTS.find(p => normName(p.name) === wanted || normName(p.name).includes(wanted) || wanted.includes(normName(p.name)));
    if (customMatch && customMatch.coordinates) {
      return { name: customMatch.name, lngLat: { lng: customMatch.coordinates[0], lat: customMatch.coordinates[1] } };
    }

    // 2. Find best match in mapbox tileset by containment both ways.
    const match = feats.find((ft) => {
      const n = normName(ft?.properties?.name);
      return n === wanted || n.includes(wanted) || wanted.includes(n);
    });
    if (!match) return null;
    return { name: match.properties.name, lngLat: { lng: match.geometry.coordinates[0], lat: match.geometry.coordinates[1] } };
  }

  async function tileQueryByName(name) {
    // Tilequery by name isn't supported directly; we use the island center and filter
    const center = [-79.745, 32.80];
    const points = accessCache || getAccessPointsFromMap() || [];
    const wanted = normName(name);

    // 1. Check bypass list first for instant resolution (crucial for unpublished points like Coconut Joe's and Pavilion Drive)
    const customMatch = CUSTOM_POPULAR_POINTS.find(p => normName(p.name) === wanted || normName(p.name).includes(wanted) || wanted.includes(normName(p.name)));
    if (customMatch && customMatch.coordinates) {
      return { name: customMatch.name, lngLat: { lng: customMatch.coordinates[0], lat: customMatch.coordinates[1] } };
    }

    const filtered = points.filter(p => {
      const n = normName(p.name);
      return n.includes(wanted) || wanted.includes(n);
    });
    if (!filtered.length) return null;
    return findNearestPoint(filtered, { lng: center[0], lat: center[1] });
  }

  async function resolveSelectionFromAddress() {
    // Day visitors don't enter an address — they just click a point.
    if (String(stayType).toLowerCase() === "day") {
      return selectedAccess || null;
    }

    const raw = addressInput?.value?.trim();
    if (!raw) return null;

    // If a user types a known resort/landmark name (e.g. "Windjammer"), treat it as the
    // *selected access point* rather than geocoding it and picking the nearest access.
    // This avoids defaults like "28th Ave Beach Access" when Mapbox returns an imprecise location.
    const baseAliases = [
      // Coconut Joe's (restaurant)
      { match: "coconut joes", name: "Coconut Joe's" },
      { match: "cocunut joes", name: "Coconut Joe's" },
      { match: "coconut joe's", name: "Coconut Joe's" },
      { match: "coconut joe’s", name: "Coconut Joe's" },
      { match: "coconut joe", name: "Coconut Joe's" },
      { match: "coconut", name: "Coconut Joe's" },
      // Palms Hotel — match hotel-specific typos but NOT addresses like "Palm Blvd"
      { match: "palms hotel", name: "Palms Hotel" },
      { match: "palm hotel", name: "Palms Hotel" },
      { match: "palms hotels", name: "Palms Hotel" },
      { match: "palm hotels", name: "Palms Hotel" },
      { match: "the palms hotel", name: "Palms Hotel" },
      { match: "the palm hotel", name: "Palms Hotel" },
      { match: "palms resort", name: "Palms Hotel" },
      { match: "palm resort", name: "Palms Hotel" }
    ];

    // Auto-generate aliases for ALL popular items (Palms Hotel, Seaside Inn, Pavilion Drive, etc.)
    const DIRECT_ACCESS_ALIASES = [
      ...baseAliases,
      ...POPULAR_OVERNIGHT_MATCH_NAMES.map(n => ({ match: normName(n), name: String(n) }))
    ];

    // Condo / resort names that should be handled on the Condo page instead of the Address page.
    const CONDO_NAME_TRIGGERS = [
      "ocean palms",
      "sea cabins",
      "mariners walk",
      "shipwatch",
      "ship watch",
      "shipwatch villa",
      "ship watch villa",
      "beach club villas",
      "beachclub villas",
      "beach club villa 1",
      "beachclub villa 1",
      "beach club villa 2",
      "beachclub villa 2",
      "summer house villas",
      "port o'call 1",
      "port ocall 1",
      "ocean club",
      "seascape",
      "sea scape",
      "board walk inn",
      "boardwalk inn"
    ];

    const rawNorm = normName(raw);

    // Condo name entered? Prompt user to use Condo page (and DO NOT select anything on this page).
    // Match both spaced and unspaced inputs (e.g. "shipwatch" vs "ship watch", "beachclub" vs "beach club")
    const _condensed = rawNorm.replace(/\s+/g, "");
    const _condoHit = CONDO_NAME_TRIGGERS.find(t => {
      const tn = String(t || "").toLowerCase().replace(/[’']/g, "").trim();
      const tc = tn.replace(/\s+/g, "");
      if (!tc) return false;
      // require a meaningful amount typed to avoid 1-letter/partial spam
      if (_condensed.length < Math.min(6, tc.length)) return false;
      return _condensed.includes(tc) || tc.includes(_condensed) || rawNorm.includes(tn);
    });

    if (_condoHit) {
      // Clear any previous selection so the Address page never "picks" an access for condos.
      try { setSelected(null); } catch (e) { }
      try { selectedAccess = null; } catch (e) { }
      try {
        if (map && recommendedSourceReady) {
          const src = map.getSource("recommendedPt");
          src && src.setData({ type: "FeatureCollection", features: [] });
        }
      } catch (e) { }
      try {
        if (map && nearbySourceReady) {
          const src = map.getSource("nearbyPts");
          src && src.setData({ type: "FeatureCollection", features: [] });
        }
      } catch (e) { }
      try { setBeachfrontDot(null); } catch (e) { }
      try { if (typeof window.showCondoRedirectModal === "function") window.showCondoRedirectModal(); } catch (e) { }
      return null;
    }

    // Direct POI hit (only when the full keyword is present — prevents 1-letter triggers)
    const directHit = DIRECT_ACCESS_ALIASES.find(a => rawNorm === a.match || rawNorm.includes(a.match));
    if (directHit) {
      let direct = null;
      try {
        direct = await tileQueryFindByName(directHit.name);
      } catch (e) {
        // ignore and fallback below
      }
      if (!direct) {
        try {
          direct = await tileQueryByName(directHit.name);
        } catch (e) { }
      }

      const directLngLat = direct?.lngLat || null;

      // Persist selection as "address" as well so your checkout note always contains what they typed.
      try {
        if (orderState && typeof orderState.set === "function") {
          orderState.set({
            address: raw,
            addressLatLng: directLngLat ? { lng: directLngLat.lng, lat: directLngLat.lat } : null,
            stayType,
            oceanfrontDetected: false
          });
        }
      } catch (e) { }

      // Map UX: move to the access point and drop the red pin there (helps users visually confirm).
      if (map && directLngLat) {
        const coords = [directLngLat.lng, directLngLat.lat];
        setAddressMarker(coords);
        map.flyTo({ center: coords, zoom: 16 });
      }

      // Clear any oceanfront dot/modal state.
      lastBeachfront = null;
      setBeachfrontDot(null);

      return {
        name: directHit.name,
        lngLat: directLngLat || { lng: -79.745, lat: 32.80 },
        oceanfrontDetected: false,
        addressLngLat: directLngLat ? [directLngLat.lng, directLngLat.lat] : null,
        recommendedName: directHit.name,
        recommendedLngLat: directLngLat || { lng: -79.745, lat: 32.80 }
      };
    }

    const geo = await geocodeAddress(raw);
    if (!geo) {
      if (typeof window.showInvalidAddressModal === "function") window.showInvalidAddressModal();
      return null;
    }

    // persist address + latlng
    if (orderState && typeof orderState.set === "function") {
      orderState.set({
        address: geo.placeName,
        addressLatLng: { lng: geo.lngLat[0], lat: geo.lngLat[1] },
        stayType
      });
    }

    if (map) {
      setAddressMarker(geo.lngLat);
    }

    if (geo.isOffIsland) {
      const defaultName = "Pavilion Drive";
      let pDa = null;
      try { pDa = await tileQueryFindByName(defaultName); } catch (e) { }
      if (!pDa) {
        try { pDa = await tileQueryByName(defaultName); } catch (e) { }
      }

      const fallbackCustom = CUSTOM_POPULAR_POINTS.find(p => p.name === defaultName)?.coordinates;
      const fallbackCoords = fallbackCustom ? { lng: fallbackCustom[0], lat: fallbackCustom[1] } : { lng: -79.787600, lat: 32.785000 };

      const coords = pDa?.lngLat || fallbackCoords;

      if (map) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(geo.lngLat);
        bounds.extend([coords.lng, coords.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      }

      return {
        name: "Pavilion Drive",
        lngLat: coords,
        oceanfrontDetected: false,
        addressLngLat: geo.lngLat,
        recommendedName: "Pavilion Drive",
        recommendedLngLat: coords
      };
    }

    if (map) {
      map.flyTo({ center: geo.lngLat, zoom: 15 });
    }


    // NOTE: geocoder returns `lngLat` (not `center`).
    const oceanfrontDetected = await isOceanfrontAddress(geo.placeName, geo.lngLat);
    // Keep the address pinned even for oceanfront homes, but STILL suggest the closest access point
    // (users can always switch via the popular list or by clicking a point on the map).
    try {
      const cur = orderState?.get?.() || {};
      orderState?.set?.({ ...cur, oceanfrontDetected });
    } catch (e) { }



    // Sand Dune Ln homes should use the private Sand Dune Beach Access point (not the nearest public avenue access).
    const onSandDuneLn = norm(geo.placeName).includes("sand dune ln") || norm(raw).includes("sand dune ln");
    if (onSandDuneLn) {
      try {
        const byName = await tileQueryFindByName("Sand Dune Beach Access");
        if (byName && byName.lngLat) {
          return {
            name: "Sand Dune Beach Access",
            lngLat: byName.lngLat,
            oceanfrontDetected,
            addressLngLat: geo.lngLat,
            recommendedName: "Sand Dune Beach Access",
            recommendedLngLat: byName.lngLat
          };
        }

        // Try common misspelling from tileset/labels
        const byName2 = await tileQueryFindByName("Sand Dune Beach Acess");
        if (byName2 && byName2.lngLat) {
          return {
            name: "Sand Dune Beach Access",
            lngLat: byName2.lngLat,
            oceanfrontDetected,
            addressLngLat: geo.lngLat,
            recommendedName: "Sand Dune Beach Access",
            recommendedLngLat: byName2.lngLat
          };
        }

        // If the tileset hasn't been republished yet, the point may not be returned by tilequery.
        // In that case, geocode the access label itself and use that coordinate.
        try {
          const g1 = await geocodeAddress("Sand Dune Beach Access, Isle of Palms, SC");
          if (g1?.lngLat) {
            return {
              name: "Sand Dune Beach Access",
              lngLat: { lng: g1.lngLat[0], lat: g1.lngLat[1] },
              oceanfrontDetected,
              addressLngLat: geo.lngLat,
              recommendedName: "Sand Dune Beach Access",
              recommendedLngLat: { lng: g1.lngLat[0], lat: g1.lngLat[1] }
            };
          }
        } catch (e) { }

        // Last resort: look for any nearby access point containing "sand dune" + "access"
        try {
          const nearby = await tileQueryNearby(geo.lngLat, 5000, 60);
          const hit = nearby.find(p => {
            const n = normName(p.name);
            return n.includes("sand dune") && n.includes("access");
          });
          if (hit && hit.lngLat) {
            return {
              name: "Sand Dune Beach Access",
              lngLat: { lng: hit.lngLat[0], lat: hit.lngLat[1] },
              oceanfrontDetected,
              addressLngLat: geo.lngLat,
              recommendedName: "Sand Dune Beach Access",
              recommendedLngLat: { lng: hit.lngLat[0], lat: hit.lngLat[1] }
            };
          }
        } catch (e) { }
      } catch (e) { }
    }

    // Otherwise choose closest access point.
    // We try a fast local search first (features already loaded in the map),
    // then fall back to Mapbox Tilequery (reliable even when tiles aren't loaded yet).

    const allowed = (stayType === "day") ? POPULAR_MATCH_NAMES : null;

    const points = (accessCache && accessCache.length)
      ? accessCache
      : (getAccessPointsFromMap() || []);

    // If we don't yet have points loaded (first render), wait briefly for tiles to load.
    if (!points.length) {
      try { await new Promise(r => setTimeout(r, 350)); } catch (e) { }
    }

    const target = { lng: geo.lngLat[0], lat: geo.lngLat[1] };

    // Condo logic: decide whether this address should use condo-only access points
    const condoKey = condoKeyFromText(raw) || condoKeyFromText(geo.placeName);


    let nearestFound = null;


    // Local nearest (no network)
    if (points.length) {
      const allowedSet = (Array.isArray(allowed) && allowed.length)
        ? new Set(allowed.map(a => normName(a)))
        : null;
      const pool0 = allowedSet
        ? points.filter(p => allowedSet.has(normName(p.name)))
        : points;

      // Apply condo filtering:
      // - if condoKey is set -> ONLY points from that condo complex
      // - else -> EXCLUDE condo points entirely (homes should not be recommended to condos)
      const pool = condoKey
        ? pool0.filter(p => condoKeyFromPointName(p.name) === condoKey)
        : pool0.filter(p => !condoKeyFromPointName(p.name));
      const nearestLocal = findNearestPoint(pool.length ? pool : points, target);
      if (nearestLocal) nearestFound = { ...nearestLocal };
    }

    // Reliable fallback: Tilequery nearest
    try {
      const nearestRemote = await tileQueryNearest(geo.lngLat, allowed, condoKey);
      if (nearestRemote) nearestFound = { ...nearestRemote };
    } catch (e) {
      console.warn("Tilequery fallback failed", e);
    }


    // If we found a nearest access point, decide what the *selected* point should be.
    if (nearestFound) {
      if (oceanfrontDetected) {
        const displayAddr = (raw && raw.length) ? raw : (String(geo.placeName || "").split(",")[0] || "Oceanfront Address");
        const beachDrop = computeBeachfrontDrop(geo.lngLat, nearestFound.lngLat);
        lastBeachfront = { name: displayAddr, lngLat: beachDrop };
        setBeachfrontDot(beachDrop);
        // Selected = custom beachfront spot; Recommended = nearest access point
        return {
          name: displayAddr,
          lngLat: beachDrop,
          oceanfrontDetected: true,
          addressLngLat: geo.lngLat,
          recommendedName: nearestFound.name,
          recommendedLngLat: nearestFound.lngLat
        };
      } else {
        lastBeachfront = null;
        setBeachfrontDot(null);
        return {
          ...nearestFound,
          oceanfrontDetected: false,
          addressLngLat: geo.lngLat,
          recommendedName: nearestFound.name,
          recommendedLngLat: nearestFound.lngLat
        };
      }
    }

    // If day visitors but none matched, pick first day point
    if (stayType === "day") {
      const fallback = await tileQueryByName(getPopularButtons()[0]);
      return fallback || { name: getPopularButtons()[0], lngLat: geo.lngLat };
    }

    return null;
  }

  async function handleNext() {
    nextBtn?.setAttribute("disabled", "disabled");
    nextBtn && (nextBtn.textContent = "Working...");

    try {
      // Ensure we have an address and a selected access (or oceanfront)
      const selection = await resolveSelectionFromAddress();

      if (!selection) {
        if (String(stayType).toLowerCase() === "day") {
          alert("Please select a beach access point.");
        } else {
          // (removed)
        }
        return;
      }

      setSelected({ name: selection.name, lngLat: selection.lngLat });

      // Save beach access + special instructions
      if (orderState && typeof orderState.set === "function") {
        const st = orderState.get();
        const address = st?.address || "";
        const noteLines = [
          `Stay type: ${stayType === "day" ? "Visiting for the day" : "Staying overnight"}`,
          `Address: ${address}`,
          `Beach access: ${selection.name}`
        ];
        orderState.set({
          beachAccess: selection.name,
          specialInstructions: noteLines.join("\n")
        });
      }

      // Move to gear selection
      window.location.href = "order-gear.html";
    } catch (err) {
      console.error(err);
      alert("Sorry — something went wrong selecting your beach access. Please try again.");
    } finally {
      nextBtn?.removeAttribute("disabled");
      nextBtn && (nextBtn.textContent = "Next: Pick Gear →");
    }
  }

  function initMap() {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: mapEl,
      style: MAP_STYLE,
      center: [-79.74, 32.80],
      zoom: 12
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("accessPts", {
        type: "vector",
        url: `mapbox://${TILESET_ID}`
      });

      // A small, always-clickable dot for the *recommended* access point.
      // This stays visible even if the user clicks a different yellow dot.
      map.addSource("recommendedPt", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });
      recommendedSourceReady = true;
      // Custom beachfront setup point (yellow dot on the sand for oceanfront homes)
      map.addSource("beachfrontPt", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      beachfrontSourceReady = true;


      // Nearby suggestions (top closest access points around the entered address)
      map.addSource("nearbyPts", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      nearbySourceReady = true;

      // Custom points that must always show as yellow dots (even if tileset is stale)
      map.addSource("customPopularPts", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: (CUSTOM_POPULAR_POINTS || []).map(p => ({
            type: "Feature",
            properties: { name: p.name },
            geometry: { type: "Point", coordinates: p.coordinates }
          }))
        }
      });
      customPopularSourceReady = true;


      // Mapbox GL JS layer `filter` uses the legacy filter syntax (not expressions).
      // Keep it simple: match exact `name` values from your tileset.
      const dayFilter = [
        "in",
        "name",
        ...POPULAR_DAY_MATCH_NAMES.map(n => String(n))
      ];

      // Overnight: show ONLY your Top-20 popular dots (small yellow circles), like your example.
      const overnightFilter = [
        "in",
        "name",
        ...POPULAR_OVERNIGHT_MATCH_NAMES.map(n => String(n))
      ];

      map.addLayer({
        id: "accessPts-circles",
        type: "circle",
        source: "accessPts",
        "source-layer": SOURCE_LAYER,
        paint: {
          // Small dots like your screenshot
          "circle-radius": 5,
          "circle-color": "#F2C94C",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        },
        filter: (stayType === "day") ? dayFilter : overnightFilter
      });

      // Custom always-on yellow dots (ex: Coconut Joe's)
      map.addLayer({
        id: "customPopular-circles",
        type: "circle",
        source: "customPopularPts",
        paint: {
          "circle-radius": 5,
          "circle-color": "#F2C94C",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });

      // Nearby options around the entered address (gives customers alternative access points to click)
      map.addLayer({
        id: "nearby-circles",
        type: "circle",
        source: "nearbyPts",
        paint: {
          "circle-radius": 7,
          "circle-color": "#F2C94C",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9
        }
      });

      // Recommended dot (yellow) — separate from the popular dots layer.
      map.addLayer({
        id: "recommended-circle",
        type: "circle",
        source: "recommendedPt",
        paint: {
          "circle-radius": 6,
          "circle-color": "#F2C94C",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });

      // Beachfront setup dot (yellow) — for oceanfront homes (chairs/umbrella set up in front of the property).
      map.addLayer({
        id: "beachfront-circle",
        type: "circle",
        source: "beachfrontPt",
        paint: {
          "circle-radius": 7,
          "circle-color": "#F2C94C",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });

      // Warm the access point cache once tiles are in view (avoids Tilequery permission issues)
      const islandBounds = [[-79.92, 32.74], [-79.70, 32.82]]; // approx Isle of Palms

      // Day visitors: zoom in to the area between 9th Ave Beach Access and Pavilion Drive
      // so they immediately see the most relevant drop-off zone.
      // Overnight visitors: show the full island so they can see all access points.
      const dayBounds = [[-79.7920, 32.7830], [-79.7855, 32.7860]]; // 9th Ave ↔ Pavilion Drive area (tight zoom)
      const initialBounds = (stayType === "day") ? dayBounds : islandBounds;
      const initialPadding = (stayType === "day") ? 60 : 40;
      try { map.fitBounds(initialBounds, { padding: initialPadding, duration: 0 }); } catch (e) { }
      map.once("idle", () => {
        accessCache = getAccessPointsFromMap() || [];
        try {
          // Build coastline model from the *popular dot* features so we can tell true oceanfront from "across the street".
          const feats = map.querySourceFeatures("accessPts", {
            sourceLayer: SOURCE_LAYER,
            filter: (stayType === "day") ? dayFilter : overnightFilter
          }) || [];
          coastlineModel = fitCoastlineModelFromFeatures(feats);
        } catch (e) {
          coastlineModel = null;
        }
      });

      map.addLayer({
        id: "accessPts-labels",
        type: "symbol",
        source: "accessPts",
        "source-layer": SOURCE_LAYER,
        minzoom: 13.5,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top"
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.8)",
          "text-halo-width": 2
        },
        filter: (stayType === "day") ? dayFilter : overnightFilter
      });

      map.addLayer({
        id: "customPopular-labels",
        type: "symbol",
        source: "customPopularPts",
        minzoom: 13.5,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top"
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.8)",
          "text-halo-width": 2
        }
      });

      map.on("click", "accessPts-circles", (e) => {
        const ft = e?.features?.[0];
        if (!ft) return;
        const name = ft.properties?.name || "Beach Access";
        const lngLat = ft.geometry?.coordinates;
        if (!lngLat) return;
        setSelected({ name, lngLat });
      });

      // Nearby suggestions (click to switch)
      map.on("click", "nearby-circles", (e) => {
        const ft = e?.features?.[0];
        if (!ft) return;
        const name = ft.properties?.name || "Beach Access";
        const lngLat = ft.geometry?.coordinates;
        if (!lngLat) return;
        setSelected({ name, lngLat });
      });

      // Custom dots (click to switch)
      map.on("click", "customPopular-circles", (e) => {
        const ft = e?.features?.[0];
        if (!ft) return;
        const name = ft.properties?.name || "Beach Access";
        const lngLat = ft.geometry?.coordinates;
        if (!lngLat) return;
        setSelected({ name, lngLat });
      });


      // Clicking the recommended dot switches back to the recommended access point.
      map.on("click", "recommended-circle", (e) => {
        const ft = e?.features?.[0];
        if (!ft) return;
        const name = ft.properties?.name || "Beach Access";
        const lngLat = ft.geometry?.coordinates;
        if (!lngLat) return;
        setSelected({ name, lngLat });
      });


      // Clicking the beachfront dot switches back to the custom "setup on the sand" point (if present).
      map.on("click", "beachfront-circle", (e) => {
        if (!lastBeachfront || !lastBeachfront.lngLat) return;
        setSelected({ name: lastBeachfront.name, lngLat: lastBeachfront.lngLat });
      });

      map.on("mouseenter", "beachfront-circle", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "beachfront-circle", () => map.getCanvas().style.cursor = "");

      map.on("mouseenter", "accessPts-circles", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "accessPts-circles", () => map.getCanvas().style.cursor = "");

      map.on("mouseenter", "nearby-circles", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "nearby-circles", () => map.getCanvas().style.cursor = "");

      map.on("mouseenter", "customPopular-circles", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "customPopular-circles", () => map.getCanvas().style.cursor = "");

      map.on("mouseenter", "recommended-circle", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "recommended-circle", () => map.getCanvas().style.cursor = "");

      showPopularButtons();
    });
  }

  // Debounced address -> pin + pick nearest access point (or oceanfront)
  let addrTimer = null;
  async function onAddressChanged() {
    if (String(stayType).toLowerCase() === "day") return; // no address box
    const raw = addressInput?.value?.trim();
    if (!raw) {
      document.body.classList.remove("has-address-results");
      setSelected(null);
      if (addressMarker) { addressMarker.remove(); addressMarker = null; }
      lastAutoSelected = null;
      // Clear recommended dot
      try {
        if (map && recommendedSourceReady) {
          const src = map.getSource("recommendedPt");
          src && src.setData({ type: "FeatureCollection", features: [] });
        }
      } catch (e) { }
      // Clear beachfront dot
      try {
        if (map && beachfrontSourceReady) {
          const src2 = map.getSource("beachfrontPt");
          src2 && src2.setData({ type: "FeatureCollection", features: [] });
        }
      } catch (e) { }
      lastBeachfront = null;

      // Clear nearby suggestions
      try {
        if (map && nearbySourceReady) {
          const s3 = map.getSource("nearbyPts");
          s3 && s3.setData({ type: "FeatureCollection", features: [] });
        }
      } catch (e) { }


      showPopularButtons();
      if (suggestionList) suggestionList.innerHTML = "";
      return;
    }

    try {
      const selection = await resolveSelectionFromAddress();
      if (!selection) {
        document.body.classList.remove("has-address-results");
        setSelected(null);
        if (addressMarker) { addressMarker.remove(); addressMarker = null; }
        if (suggestionList) suggestionList.innerHTML = "";
        return;
      }

      document.body.classList.add("has-address-results");
      try { setTimeout(() => map && map.resize && map.resize(), 50); } catch (e) {}

      // Keep the address-based recommendation available even if the user switches dots later.
      lastAutoSelected = { name: selection.recommendedName || selection.name, lngLat: selection.recommendedLngLat || selection.lngLat };

      // Show a persistent yellow dot for the recommended point.
      try {
        if (map && recommendedSourceReady && lastAutoSelected?.lngLat) {
          const src = map.getSource("recommendedPt");
          const coords = Array.isArray(lastAutoSelected.lngLat)
            ? lastAutoSelected.lngLat
            : [lastAutoSelected.lngLat.lng, lastAutoSelected.lngLat.lat];
          src && src.setData({
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              properties: { name: lastAutoSelected.name },
              geometry: { type: "Point", coordinates: coords }
            }]
          });
        }
      } catch (e) { }

      // Show additional nearby access points around the entered address (so customers can switch easily)
      try {
        if (selection.addressLngLat && Array.isArray(selection.addressLngLat)) {
          const nearby = await tileQueryNearby(selection.addressLngLat, 2200, 14);
          // Keep it tight: unique by name
          const seen = new Set();
          const uniq = [];
          for (const p of nearby) {
            const k = normName(p.name);
            if (seen.has(k)) continue;
            seen.add(k);
            uniq.push(p);
          }
          setNearbyDots(uniq.slice(0, 10));
        }
      } catch (e) {
        console.warn("nearby suggestions failed", e);
      }

      showPopularButtons();


      // Oceanfront hint: still auto-select the closest access, but let the user know.
      const oceanfrontNote = selection.oceanfrontDetected ? " <strong>Oceanfront detected.</strong> We'll deliver at your house." : "";

      setSelected({ name: selection.name, lngLat: selection.lngLat });
      if (suggestionList) {
        suggestionList.innerHTML = `<div class=\"help\"><strong>Closest access:</strong> ${escapeHtml(selection.name)} (auto-selected)</div>${oceanfrontNote ? `<div class=\"help\">${oceanfrontNote}</div>` : ""}`;
      }
    } catch (e) {
      console.error(e);
    }
  }

  function debounceAddress() {
    if (addrTimer) clearTimeout(addrTimer);
    addrTimer = setTimeout(onAddressChanged, 550);
  }

  // --- Start ---
  if (!mapEl) return;

  if (String(stayType).toLowerCase() === "day") { document.body.classList.add("has-address-results"); }

  // Back button (don't rely on history because users sometimes open pages directly)
  document.getElementById("backBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "order-stay.html";
  });

  initMap();
  nextBtn?.addEventListener("click", handleNext);
  addressInput?.addEventListener("input", debounceAddress);
  addressInput?.addEventListener("change", onAddressChanged);
})();

// --- Oceanfront note logic ---
function updateOceanfrontNote(selectedText) {
  const noteEl = document.getElementById("oceanfront-note");
  if (!noteEl) return;

  // Exclude known tourist-attraction addresses that should not receive the oceanfront note
  const lowered = String(selectedText || "").toLowerCase();
  const isExcluded = /\b1116\s+ocean\s*blvd\b/i.test(lowered) || /\b1140\s+ocean\s*blvd\b/i.test(lowered);
  if (isExcluded) {
    noteEl.style.display = "none";
    return;
  }

  const isOceanfront =
    /\d+/.test(selectedText) &&
    (selectedText.toLowerCase().includes("ocean blvd") || selectedText.toLowerCase().includes("palm blvd"));

  if (isOceanfront) {
    noteEl.style.display = "block";
  } else {
    noteEl.style.display = "none";
  }
}

// --- Oceanfront modal (prettier than alert) ---
// Exposed globally so the selection logic can call it.
window.showOceanfrontModal = (function () {
  let wired = false;
  let overlay, dialog, closeBtn, okBtn;

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }

  function open() {
    overlay = overlay || document.getElementById("oceanfrontModal");
    if (!overlay) return;
    dialog = dialog || overlay.querySelector(".bb-modal");
    closeBtn = closeBtn || overlay.querySelector(".bb-modal-close");
    okBtn = okBtn || overlay.querySelector(".bb-modal-btn");

    if (!wired) {
      wired = true;

      // Close when clicking the X / button
      closeBtn?.addEventListener("click", close);
      okBtn?.addEventListener("click", close);

      // Close when clicking outside the dialog
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });

      // Close on ESC
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    }

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");

    // Focus the primary button for accessibility
    setTimeout(() => okBtn?.focus(), 0);
  }

  return function showOceanfrontModal() {
    open();
  };
})();



// ---------- Invalid Address modal ----------
window.showInvalidAddressModal = (function () {
  let wired = false;
  return function () {
    const overlay = document.getElementById("invalidAddressModal");
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");

    if (!wired) {
      wired = true;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) window.closeInvalidAddressModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("is-open")) {
          window.closeInvalidAddressModal();
        }
      });
    }
  };
})();

window.closeInvalidAddressModal = function () {
  const overlay = document.getElementById("invalidAddressModal");
  if (overlay) {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
};

// ---------- Condo redirect modal ----------
window.showCondoRedirectModal = (function () {
  let overlay;

  function ensureStyles() {
    if (document.getElementById("bbCondoModalStyles")) return;
    const style = document.createElement("style");
    style.id = "bbCondoModalStyles";
    style.textContent = `
      .bb-modal-overlay{
        position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,.55); backdrop-filter: blur(6px);
        z-index: 9999; opacity:0; pointer-events:none; transition:opacity .15s ease;
      }
      .bb-modal-overlay.is-open{opacity:1; pointer-events:auto;}
      .bb-modal{
        width:min(560px, calc(100vw - 32px));
        border-radius:18px;
        background: rgba(18, 28, 40, .92);
        border:1px solid rgba(255,255,255,.10);
        box-shadow: 0 20px 80px rgba(0,0,0,.55);
        padding:18px 18px 14px;
        color:#fff;
      }
      .bb-modal__title{font-size:18px; font-weight:700; margin:0 0 8px;}
      .bb-modal__text{margin:0 0 14px; line-height:1.4; color:rgba(255,255,255,.85);}
      .bb-modal__actions{display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;}
      .bb-modal__btn{
        border-radius:12px; padding:10px 14px; font-weight:700; cursor:pointer;
        border:1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.08);
        color:#fff;
      }
      .bb-modal__btn--primary{
        background: linear-gradient(135deg, rgba(255,166,87,.95), rgba(255,122,89,.95));
        border: none;
        color:#1b130a;
      }
      .bb-modal__btn:active{transform: translateY(1px);}
    `;
    document.head.appendChild(style);
  }

  function ensure() {
    if (overlay) return;
    ensureStyles();
    overlay = document.createElement("div");
    overlay.className = "bb-modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="bb-modal" role="dialog" aria-modal="true" aria-labelledby="bbCondoModalTitle">
        <div id="bbCondoModalTitle" class="bb-modal__title">Condo selected</div>
        <p class="bb-modal__text">
          It looks like you're staying at a condo. Please use the Condo page to select your building and unit.
        </p>
        <div class="bb-modal__actions">
          <button type="button" class="bb-modal__btn" data-action="close">Stay here</button>
          <button type="button" class="bb-modal__btn bb-modal__btn--primary" data-action="go">Go to Condo Page</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) return close();
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.getAttribute("data-action");
      if (act === "close") close();
      if (act === "go") window.location.href = "order-condo.html";
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });
  }

  return function showCondoRedirectModal() {
    ensure();
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
  };
})();


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
