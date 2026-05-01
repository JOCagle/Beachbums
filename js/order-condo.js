/* order-condo.js (Feb 2026)
   "Bullet-proof" condo flow using YOUR Mapbox tileset layout.

   Flow:
   1) User selects a Condo/Hotel/Villa (the "base" dot, NOT a beach access).
   2) Map flies to that condo dot.
   3) We populate a second dropdown with matching beach access points that share the same name prefix
      (ex: "Beach Club Villa 1" -> "Beach Club Villa 1 South/Middle/North").
   4) User selects the access (or clicks a blue marker). That becomes their Selected access point.

   Notes:
   - No unit numbers.
   - No orange dot layers. We only show markers for the selected condo + the matching access options.
*/

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // -------- Mapbox + tileset config --------
  const MAPBOX_TOKEN = "pk.eyJ1IjoiamNhZ2xlMDUxMyIsImEiOiJjbWtlZjZtNTEwNmpjM2ZwdzNncmd4bmtxIn0.77ShM5FPhsnCEu4k3YJoxw";
  // IMPORTANT:
  // Your WORKING order-address page loads points from this tileset id.
  // (The friendly Studio name can be different — the tileset id is the "username.<hash>" string.)
  // Using the wrong id causes the 404s you see in DevTools.
  const TILESET_ID = "jcagle0513.cmlkefqyp0lve1ok643wotmic-0910x";
  const SOURCE_LAYER = "iop_beach_access_points";

  const IOP_CENTER = { lng: -79.7882, lat: 32.7868 };

  // -------- State helper (matches the rest of your site) --------
  const OrderState = (window.BeachBumsOrderState || null);

  // Cookie helpers (checkout runs on a subdomain, so we need domain=.beachbumsiop.com)
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
    } catch (_) {}
  }
  function clearCookieShared(name) {
    try {
      let cookie = `${name}=; path=/; max-age=0; SameSite=None`;
      if (location.protocol === 'https:') cookie += '; Secure';
      if (!isLocalHost()) cookie += `; domain=${COOKIE_DOMAIN}`;
      document.cookie = cookie;
    } catch (_) {}
  }

  function setStateAccess(accessName, condoName) {
    const accessClean = String(accessName || '').replace(/\s*\(popular pick\)\s*/ig, '').trim();
    const note = accessClean ? `Selected access point: ${accessClean}` : '';
    const special = condoName ? `Condo/Hotel/Villa: ${condoName}${note ? ' | ' + note : ''}` : note;

    // Expose for any checkout bridge scripts
    try { window.selectedAccessPoint = accessClean || ''; } catch (_) {}

    // Canonical shared order-state (same as order-address page)
    try {
      if (OrderState && typeof OrderState.get === 'function' && typeof OrderState.set === 'function') {
        const current = OrderState.get();
        OrderState.set({
          ...current,
          // staff-facing
          // If access isn't chosen yet, clear any prior access so checkout can't carry a stale value.
          deliveryNote: accessClean ? (note || (current.deliveryNote || '')) : '',
          specialInstructions: special || (current.specialInstructions || ''),
          // customer-facing
          beachAccess: accessClean ? (accessClean || (current.beachAccess || '')) : '',
          chosenAccess: accessClean
            ? { name: accessClean, type: 'access' }
            : '',
          // keep a record of what condo they picked (for your reference later)
          stayDetails: { stayType: 'condo', condoName: condoName || '', unit: '' }
        });
      }
    } catch (_) {}

    // Cookie fallback (shared across subdomains).
    // Note: OrderState.set() already calls saveOrder() which sets these too,
    // but we keep this as a belt-and-suspenders in case order-state.js isn't loaded.
    if (accessClean) {
      setCookieShared('bb_access_point', accessClean);
      setCookieShared('bb_beach_access', accessClean);
      setCookieShared('bb_delivery_note', note);
      setCookieShared('bb_note_ts', String(Date.now()));
    } else {
      clearCookieShared('bb_access_point');
      clearCookieShared('bb_beach_access');
      clearCookieShared('bb_delivery_note');
      clearCookieShared('bb_note_ts');
    }
  }

  // -------- Tileset loading --------
  let ALL_POINTS = []; // [{ name, lng, lat }]

  // Tilequery helper (used both for initial warm cache + targeted queries)
  async function tilequeryAt(lng, lat, withLayer, opts) {
    const o = opts || {};
    // Mapbox Tilequery has strict parameter limits.
    // Keeping these within documented bounds avoids 422 (Unprocessable Content).
    // - limit: max 50
    // - radius: max 10000 meters
    const limitRaw = Number.isFinite(o.limit) ? o.limit : 50;
    const limit = Math.max(1, Math.min(50, Math.round(limitRaw)));
    const radiusRaw = Number.isFinite(o.radius) ? o.radius : 8000;
    const radius = Math.max(0, Math.min(10000, Math.round(radiusRaw)));
    const base = `https://api.mapbox.com/v4/${TILESET_ID}/tilequery/${lng},${lat}.json`;
    const qs = [];
    if (withLayer) qs.push(`layers=${encodeURIComponent(SOURCE_LAYER)}`);
    qs.push(`limit=${encodeURIComponent(String(limit))}`);
    qs.push(`radius=${encodeURIComponent(String(radius))}`);
    qs.push(`access_token=${MAPBOX_TOKEN}`);
    const url = `${base}?${qs.join('&')}`;
    const res = await fetch(url);
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) {}
      console.warn('[Tilequery] failed', res.status, res.statusText, detail);
      throw new Error('Tilequery failed');
    }
    const data = await res.json();
    return (data && data.features) ? data.features : [];
  }

  function setError(msg) {
    const el = $('#condoError');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = msg;
  }

  async function loadAllPointsOnce() {
    if (ALL_POINTS.length) return ALL_POINTS;

    // Fast + stable path:
    // 1) Query currently loaded vector tiles (no camera sweeps)
    // 2) Always supplement with Tilequery calls (in parallel) for far-east points
    const merged = [];
    const seen = new Set();

    // (1) Best effort: read whatever tiles are already loaded at the default view.
    if (map && map.getStyle && typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      try {
        const SRC_ID = 'bb_iop_points_src';
        const LAYER_ID = 'bb_iop_points_layer_hidden';
        if (!map.getSource(SRC_ID)) {
          map.addSource(SRC_ID, { type: 'vector', url: `mapbox://${TILESET_ID}` });
        }
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SRC_ID,
            'source-layer': SOURCE_LAYER,
            paint: { 'circle-radius': 4, 'circle-opacity': 0 }
          });
        }

        await new Promise((resolve) => map.once('idle', resolve));
        const feats = map.querySourceFeatures(SRC_ID, { sourceLayer: SOURCE_LAYER }) || [];
        for (const ft of feats) {
          const c = ft?.geometry?.coordinates;
          const n = ft?.properties?.name ?? ft?.properties?.Name;
          if (!c || c.length < 2 || !n) continue;
          const key = `${String(n)}|${Number(c[0]).toFixed(6)}|${Number(c[1]).toFixed(6)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push({ name: String(n), lng: c[0], lat: c[1] });
        }
      } catch (e) {
        console.warn('Vector tileset read failed, will rely on Tilequery:', e);
      }
    }

    // (2) Tilequery (parallel) for broader coverage without moving the camera.
    const centers = [
      [IOP_CENTER.lng, IOP_CENTER.lat],
      [-79.7605, 32.8098], // Wild Dunes-ish (east)
      [-79.7368, 32.8322], // Beach Club Villas area (far east)
      [-79.7488, 32.8207], // Shipwatch / Port O'Call corridor
      [-79.8085, 32.7708]  // west end / connector side
    ];

    const queries = centers.map(async (c) => {
      try {
        let feats = await tilequeryAt(c[0], c[1], true, { limit: 250, radius: 12000 });
        if (!feats.length) feats = await tilequeryAt(c[0], c[1], false, { limit: 250, radius: 12000 });
        return feats;
      } catch (e) {
        console.warn('Tilequery center failed:', e);
        return [];
      }
    });

    const results = await Promise.all(queries);
    for (const feats of results) {
      for (const ft of feats) {
        const cc = ft?.geometry?.coordinates;
        const n = ft?.properties?.name ?? ft?.properties?.Name;
        if (!cc || cc.length < 2 || !n) continue;
        const key = `${String(n)}|${Number(cc[0]).toFixed(6)}|${Number(cc[1]).toFixed(6)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ name: String(n), lng: cc[0], lat: cc[1] });
      }
    }

    ALL_POINTS = merged;
    return ALL_POINTS;
  }

  async function mergeTilequeryIntoAllPoints(lng, lat, opts) {
    const seen = new Set(ALL_POINTS.map((p) => `${String(p.name)}|${Number(p.lng).toFixed(6)}|${Number(p.lat).toFixed(6)}`));
    let feats = [];
    try {
      feats = await tilequeryAt(lng, lat, true, opts);
      if (!feats.length) feats = await tilequeryAt(lng, lat, false, opts);
    } catch (_) {
      return;
    }
    for (const ft of feats) {
      const cc = ft?.geometry?.coordinates;
      const n = ft?.properties?.name ?? ft?.properties?.Name;
      if (!cc || cc.length < 2 || !n) continue;
      const key = `${String(n)}|${Number(cc[0]).toFixed(6)}|${Number(cc[1]).toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ALL_POINTS.push({ name: String(n), lng: cc[0], lat: cc[1] });
    }
  }

  // -------- Name helpers --------
  const DIR_SUFFIX_RE = /\s+(South|Middle|North)\s*$/i;

  function stripDirSuffix(name) {
    return String(name || '').replace(DIR_SUFFIX_RE, '').trim();
  }

  function dirRank(name) {
    const m = String(name || '').match(DIR_SUFFIX_RE);
    const d = m ? m[1].toLowerCase() : '';
    if (d === 'south') return 1;
    if (d === 'middle') return 2;
    if (d === 'north') return 3;
    return 99;
  }

  function canonApos(s) {
    // Treat curly apostrophes the same as straight apostrophes so "Port O’Call" matches "Port O'Call".
    return String(s || '').replace(/[\u2018\u2019]/g, "'");
  }

  function norm(s) {
    return canonApos(s).trim().toLowerCase();
  }

  function byNameExact(name) {
    const wanted = norm(name);
    return ALL_POINTS.find((p) => norm(p.name) === wanted) || null;
  }

  function pointsByPrefix(baseName) {
    const base = norm(baseName);
    const prefix = base + ' ';
    return ALL_POINTS
      .filter((p) => {
        const n = norm(p.name);
        return n.startsWith(prefix) && n !== base;
      })
      .slice();
  }

  function computeCentroid(points) {
    if (!points || !points.length) return null;
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.lng; sy += p.lat; }
    return { lng: sx / points.length, lat: sy / points.length };
  }

  // -------- Condo list + rules (A vs B) --------
  // A: selecting the condo IS the access point.
  // B: selecting the condo is only the "stay location" dot, user must choose a matching access (South/Middle/North).
  const GROUP_A = [
    'Dunescape',
    'Seaside Inn',
    'Ocean Palms',
    '1116 Ocean Blvd',
    'Palms Hotel',
    '1140 Ocean Blvd',
    'Seagrove',
    'Summer House Villas',
    'Tidewater Villas',
    'Seascape',
    'Ocean Club',
    // Special rule (handled below): Fairway Dunes Ln -> Mariners Walk North ONLY
    'Fairway Dunes Ln'
  ];

  const GROUP_B = [
    // Base dot (NOT A/B/C). Access choices are A/B/C.
    'Sea Cabins Building',
    'Beach Club Villa 1',
    'Beach Club Villa 2',
    'Mariners Walk',
    'Shipwatch Villas',
    "Port O'Call 1",
    // Special: customers choose between TWO specific access points
    'Boardwalk Inn'
  ];

  // --- Boardwalk modal (matches Oceanfront UI) ---
  window.showBoardwalkModal = (function () {
    let wired = false;
    let overlay, closeBtn, okBtn;

    function close() {
      if (!overlay) return;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }

    function open() {
      overlay = overlay || document.getElementById('boardwalkModal');
      if (!overlay) return;
      closeBtn = closeBtn || overlay.querySelector('.bb-modal-close');
      okBtn = okBtn || overlay.querySelector('.bb-modal-btn');

      if (!wired) {
        wired = true;
        closeBtn?.addEventListener('click', close);
        okBtn?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) close();
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close();
        });
      }

      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => okBtn?.focus(), 0);
    }

    return function showBoardwalkModal() {
      open();
    };
  })();

  const GROUP_A_SET = new Set(GROUP_A.map(norm));
  const GROUP_B_SET = new Set(GROUP_B.map(norm));

  function isGroupA(name) { return GROUP_A_SET.has(norm(name)); }
  function isGroupB(name) { return GROUP_B_SET.has(norm(name)); }

  function buildCondoBaseList() {
    // Keep your preferred order (A first, then B) so the dropdown feels predictable.
    const combined = [...GROUP_A, ...GROUP_B];
    return Array.from(new Set(combined.map((s) => s.trim())));
  }

  // -------- Note popup (for B group) --------
  let noteEl = null;
  function showNote(msg) {
    if (!msg) return;
    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.setAttribute('role', 'dialog');
      noteEl.setAttribute('aria-modal', 'true');
      noteEl.style.position = 'fixed';
      noteEl.style.inset = '0';
      noteEl.style.zIndex = '9999';
      noteEl.style.display = 'grid';
      noteEl.style.placeItems = 'center';
      noteEl.style.background = 'rgba(0,0,0,0.45)';
      noteEl.innerHTML = `
        <div style="width:min(520px, calc(100vw - 36px)); background:rgba(16, 34, 46, 0.96); color:#fff; border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:18px 18px 16px; box-shadow:0 16px 50px rgba(0,0,0,0.35); position:relative;">
          <button type="button" aria-label="Close" style="position:absolute; top:10px; right:12px; width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#fff; font-size:20px; cursor:pointer;">×</button>
          <div style="font-weight:800; font-size:16px; margin-bottom:8px;">One more step</div>
          <div id="bbNoteMsg" style="font-size:14px; line-height:1.35; opacity:0.95;"></div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
            <button type="button" style="padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;">Got it</button>
          </div>
        </div>
      `;
      document.body.appendChild(noteEl);
      const close = () => { noteEl.style.display = 'none'; };
      noteEl.addEventListener('click', (e) => {
        if (e.target === noteEl) close();
      });
      noteEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', close));
    }
    const msgEl = noteEl.querySelector('#bbNoteMsg');
    if (msgEl) msgEl.textContent = msg;
    noteEl.style.display = 'grid';
  }

  // -------- Map helpers --------
  let map;
  let condoMarker = null;
  let selectedAccessMarker = null;
  let optionMarkers = []; // clickable markers for access options
  let selectedAccessName = '';

  function clearOptionMarkers() {
    for (const m of optionMarkers) {
      try { m.marker && m.marker.remove(); } catch (_) {}
    }
    optionMarkers = [];
  }

  function makeMarkerEl(kind) {
    const el = document.createElement('div');
    el.className = `bb-marker ${kind}`;
    return el;
  }

  function setMarker(which, lngLat, title) {
    if (!map || !lngLat) return;

    const marker = new mapboxgl.Marker({ element: makeMarkerEl(which === 'condo' ? 'bb-condo' : 'bb-access is-selected') })
      .setLngLat([lngLat.lng, lngLat.lat])
      .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(title || ''))
      .addTo(map);

    if (which === 'condo') {
      if (condoMarker) condoMarker.remove();
      condoMarker = marker;
    } else {
      if (selectedAccessMarker) selectedAccessMarker.remove();
      selectedAccessMarker = marker;
    }
  }

  function setSelectedLabel(text) {
    const el = $('#selectedLabel');
    if (el) el.textContent = text ? `Selected: ${text}` : '';
  }

  function setRecommended(text) {
    const el = $('#recommendedText');
    if (el) el.textContent = text ? text : '';
  }

  function fitTo(lngLatA, lngLatB) {
    if (!map) return;
    if (lngLatA && lngLatB) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lngLatA.lng, lngLatA.lat]);
      bounds.extend([lngLatB.lng, lngLatB.lat]);
      map.fitBounds(bounds, { padding: 90, maxZoom: 16.6, duration: 650 });
      return;
    }
    if (lngLatA) map.flyTo({ center: [lngLatA.lng, lngLatA.lat], zoom: 16.2, duration: 650 });
  }

  // -------- UI wiring --------
  function setNextEnabled(enabled) {
    try {
      const b1 = document.getElementById('nextBtn');
      const b2 = document.getElementById('nextBtnTop');
      if (b1) b1.disabled = !enabled;
      if (b2) b2.disabled = !enabled;
    } catch (_) {}
  }
  function fillSelect(selectEl, options, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = '';

    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder || '(Select)';
    selectEl.appendChild(opt0);

    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      selectEl.appendChild(opt);
    }
  }

  function sortAccessNames(a, b) {
    const ra = dirRank(a);
    const rb = dirRank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  }

  function chooseAccess(accessName, baseName, accessPoint) {
    if (!accessName) return;
    selectedAccessName = accessName;
    setSelectedLabel(accessName);
    setStateAccess(accessName, baseName);

    // Enable "Next" once we have a real access point.
    setNextEnabled(true);

    // Highlight selected option marker (yellow). If we don't have option markers (group A / fairway),
    // create a standalone selected access marker.
    if (accessPoint) {
      const match = optionMarkers.find((m) => norm(m.name) === norm(accessName));
      if (match) {
        // Toggle classes on all option markers
        for (const m of optionMarkers) {
          if (!m.el) continue;
          const isSel = norm(m.name) === norm(accessName);
          m.el.classList.toggle('is-selected', isSel);
        }
        // Remove standalone marker if it exists
        if (selectedAccessMarker) { try { selectedAccessMarker.remove(); } catch (_) {} selectedAccessMarker = null; }
        fitTo(
          condoMarker ? { lng: condoMarker.getLngLat().lng, lat: condoMarker.getLngLat().lat } : null,
          { lng: accessPoint.lng, lat: accessPoint.lat }
        );
      } else {
        const lngLat = { lng: accessPoint.lng, lat: accessPoint.lat };
        setMarker('access', lngLat, accessPoint.name);
        fitTo(
          condoMarker ? { lng: condoMarker.getLngLat().lng, lat: condoMarker.getLngLat().lat } : null,
          lngLat
        );
      }
    }
  }

  function setAccessRowVisible(visible) {
    const row = document.getElementById('accessRow');
    if (!row) return;
    row.style.display = visible ? '' : 'none';
  }

  async function onCondoChanged() {
    const condoSelect = $('#condoSelect');
    const accessSelect = $('#accessSelect');

    const baseName = condoSelect.value;
    clearOptionMarkers();

    if (!baseName) {
      fillSelect(accessSelect, [], '(Select a condo first)');
      setSelectedLabel('');
      setRecommended('');
      setAccessRowVisible(true);
      if (condoMarker) { condoMarker.remove(); condoMarker = null; }
      if (selectedAccessMarker) { selectedAccessMarker.remove(); selectedAccessMarker = null; }
      map.flyTo({ center: [IOP_CENTER.lng, IOP_CENTER.lat], zoom: 12.8, duration: 650 });

      // Reset next button
      setNextEnabled(false);
      return;
    }

    // Condo/base dot
    const basePoint = byNameExact(baseName);
    const groupA = isGroupA(baseName);
    const groupB = isGroupB(baseName);

    // SPECIAL: Boardwalk Inn has 2 explicit access choices (not prefix-based).
    const isBoardwalkInn = norm(baseName) === norm('Boardwalk Inn');

    // SPECIAL: Fairway Dunes Ln always recommends Mariners Walk North (and only this one).
    const isFairway = norm(baseName) === norm('Fairway Dunes Ln');

    // Access options are only for group B — except Fairway, which has a fixed pick.
    // IMPORTANT: the condo/base dot must never be selectable as an access option.
    let accessPoints = [];

    if (isBoardwalkInn) {
      // Show the Boardwalk warning modal (UI matches the oceanfront popup).
      try { window.showBoardwalkModal?.(); } catch (_) {}

      const choices = ['Seagrove', '58th Ave Beach Access'];
      accessPoints = choices.map((n) => byNameExact(n)).filter(Boolean);

      // If choices aren't available yet (tilequery truncation / not loaded), pull around Boardwalk Inn.
      if (basePoint && accessPoints.length < choices.length) {
        await mergeTilequeryIntoAllPoints(basePoint.lng, basePoint.lat, { limit: 50, radius: 3500 });
        accessPoints = choices.map((n) => byNameExact(n)).filter(Boolean);
      }
    } else {
      // Prefix-based access points (South/Middle/North style)
      accessPoints = (groupB && !isFairway) ? pointsByPrefix(baseName) : [];

      // If we didn't find matches (common when the initial Tilequery limit truncates),
      // run a targeted tilequery around the condo/base dot to pull in nearby access points.
      if (groupB && !isFairway && !accessPoints.length && basePoint) {
        await mergeTilequeryIntoAllPoints(basePoint.lng, basePoint.lat, { limit: 50, radius: 2500 });
        accessPoints = pointsByPrefix(baseName);
      }
    }
    accessPoints = accessPoints.filter((p) => norm(p.name) !== norm(baseName));
    // For Boardwalk Inn we keep the order as: Seagrove, 58th Ave Beach Access.
    if (!isBoardwalkInn) {
      accessPoints.sort((p1, p2) => sortAccessNames(p1.name, p2.name));
    }

    // De-dupe by name so the dropdown doesn't show duplicates if the tileset has repeated labels.
    if (accessPoints.length) {
      const seenNames = new Set();
      accessPoints = accessPoints.filter((p) => {
        const k = norm(p.name);
        if (seenNames.has(k)) return false;
        seenNames.add(k);
        return true;
      });
    }

    const condoLngLat = basePoint
      ? { lng: basePoint.lng, lat: basePoint.lat }
      : (accessPoints.length ? computeCentroid(accessPoints) : null);

    if (condoLngLat) setMarker('condo', condoLngLat, baseName);

    // Build access dropdown
    const accessNames = accessPoints.map((p) => p.name);
    setAccessRowVisible((groupB && !isFairway) || isBoardwalkInn);
    if ((groupB && !isFairway) || isBoardwalkInn) {
      fillSelect(accessSelect, accessNames, accessNames.length ? '(Pick your beach access)' : '(No matching access points found)');
    } else {
      fillSelect(accessSelect, [], '(Not needed)');
    }

    // Next button enabled rules:
    // - Group A: auto-selected immediately
    // - Group B: disabled until the user selects South/Middle/North
    setNextEnabled(groupA || isFairway);

    // Show clickable option markers for each access (group B only)
    if (((groupB && !isFairway) || isBoardwalkInn) && accessPoints.length) {
      for (const p of accessPoints) {
        const el = makeMarkerEl('bb-access');
        const m = new mapboxgl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(p.name))
          .addTo(map);

        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          accessSelect.value = p.name;
          chooseAccess(p.name, baseName, p);
        });
        optionMarkers.push({ marker: m, name: p.name, el, point: p });
      }
    }

    if (isFairway) {
      const fixedName = 'Mariners Walk North';
      const fixedPoint = byNameExact(fixedName);

      // Red marker should show where they're staying.
      if (condoLngLat) setMarker('condo', condoLngLat, baseName);

      // Blue marker should be the recommended access.
      if (fixedPoint) {
        chooseAccess(fixedName, baseName, fixedPoint);
        setRecommended('Recommended beach access: Mariners Walk North');
      } else {
        setSelectedLabel(fixedName);
        setStateAccess(fixedName, baseName);
        setRecommended('Recommended beach access: Mariners Walk North (not found in tileset — staff will still see it).');
      }

      // Keep map view helpful.
      if (fixedPoint) fitTo(condoLngLat, { lng: fixedPoint.lng, lat: fixedPoint.lat });
      else fitTo(condoLngLat, condoLngLat);

    } else if (groupA) {
      // A) Condo is the access point. Select it immediately.
      if (basePoint) {
        chooseAccess(baseName, baseName, basePoint);
        setRecommended('');
      } else {
        // Still store the condo name even if the dot is missing.
        setSelectedLabel(baseName);
        setStateAccess('', baseName);
        setRecommended('This condo name was not found in the Mapbox tileset. (The staff will still see the condo name.)');
      }
    } else {
      // B) User must pick one of the matched access points (or Boardwalk Inn options).
      setSelectedLabel('');
      setStateAccess('', baseName);
      // Boardwalk Inn uses the themed bb-modal (matches oceanfront UI).
      // Other condos use the existing note popup.
      if (!isBoardwalkInn) {
        showNote('Select your desired beach access and we will do the rest.');
      }

      // Keep "Next" disabled until a real access is selected
      setNextEnabled(false);

      if (selectedAccessMarker) { selectedAccessMarker.remove(); selectedAccessMarker = null; }

      if (!accessPoints.length) {
        setRecommended('No matching beach access points found for this condo name (expected South/Middle/North).');
      } else {
        setRecommended('Tip: zoom or scroll the map if needed — the blue dots are your recommended access points.');
      }
    }

    // Camera
    if (isFairway) {
      // already handled above
    } else if (groupA) {
      fitTo(condoLngLat, condoLngLat);
    } else {
      const mid = accessPoints.find((p) => /\s+Middle\s*$/i.test(p.name)) || accessPoints[0] || null;
      fitTo(condoLngLat, mid ? { lng: mid.lng, lat: mid.lat } : null);
    }
  }

  function init() {
    // Close button
    const closeBtn = $('#closeBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => { window.location.href = 'order-stay.html'; });

    // Map init
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: 'condoMap',
      // Satellite is easier for customers to understand on the beach.
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [IOP_CENTER.lng, IOP_CENTER.lat],
      zoom: 12.8
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Next button
    const goNext = (btn) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        window.location.href = 'order-gear.html';
      });
    };
    goNext(document.getElementById('nextBtn'));
    goNext(document.getElementById('nextBtnTop'));

    map.on('load', async () => {
      // Hide the map until we have points loaded to avoid the "tweaking" feel.
      const mapLoading = document.getElementById('mapLoading');
      const mapEl = document.getElementById('condoMap');
      if (mapEl) mapEl.style.opacity = '0';

      try {
        await loadAllPointsOnce();
        setError('');
      } catch (e) {
        // If tileset fails, don't hard crash; user can still proceed.
        console.warn('Could not load tileset points:', e);
        setError('Could not load the condo list from Mapbox. This usually means the tileset layer name changed or the Mapbox Tilequery request was blocked. Try testing on your live domain (not file://), or tell me the exact tileset SOURCE LAYER name shown in Mapbox Studio → Tileset → Layers.');
      }

      const condoSelect = $('#condoSelect');
      const accessSelect = $('#accessSelect');

      // Build condo dropdown from your tileset naming
      const baseNames = buildCondoBaseList();
      fillSelect(condoSelect, baseNames, '(Select your condo)');
      fillSelect(accessSelect, [], '(Select a condo first)');

      if (!baseNames.length) {
        setRecommended('No condo names were returned from the tileset. If you open DevTools → Console, you should see a “Tilequery failed” or 0-features message.');
      }

      // Now that points are loaded and dropdowns are built, reveal the map.
      try {
        if (mapEl) {
          mapEl.style.transition = 'opacity 180ms ease';
          mapEl.style.opacity = '1';
        }
        if (mapLoading) mapLoading.classList.add('is-hidden');
      } catch (_) {}

      // Give a subtle 3D feel AFTER load (so it doesn't look like it's jumping around).
      try { map.easeTo({ pitch: 55, bearing: -18, duration: 450 }); } catch (_) {}

      condoSelect.addEventListener('change', onCondoChanged);

      accessSelect.addEventListener('change', () => {
        const baseName = condoSelect.value;
        const accessName = accessSelect.value;
        if (!baseName || !accessName) return;
        const p = byNameExact(accessName);
        chooseAccess(accessName, baseName, p);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
