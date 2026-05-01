
/* =========================================================
   CLOSEST ACCESS EXCEPT BOARDWALK INN
   Keep normal closest-access behavior, but:
   - Boardwalk Inn is NOT allowed for normal house addresses.
   - If the closest result would be Boardwalk Inn, choose the next closest
     public access point instead.
   - Boardwalk Inn is allowed only when the typed address is actually
     Boardwalk Inn.
   ========================================================= */
(function () {
  const ACCESS_POINTS = [
    { name: "58th Ave Beach Access", lat: 32.805087, lng: -79.746286 },
    { name: "Seagrove", lat: 32.805781, lng: -79.741672 },
    { name: "Beachwood East", lat: 32.805982, lng: -79.739026 },
    { name: "Beachwood West", lat: 32.805445, lng: -79.742399 },
    { name: "Grand Pavilion Beach Access", lat: 32.804471, lng: -79.744289 },
    { name: "56th Ave Beach Access", lat: 32.804155, lng: -79.748704 },
    { name: "54th Ave Beach Access", lat: 32.803251, lng: -79.751195 },
    { name: "Boardwalk Inn", lat: 32.805059, lng: -79.744740, blocked: true }
  ];

  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/[.,#]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isBoardwalkInnAddress(address) {
    const a = norm(address);
    return (
      a.includes("boardwalk inn") ||
      a.includes("boardwalkinn") ||
      a.includes("boardwalk inn resort") ||
      a.includes("200 grand pavilion")
    );
  }

  function getAddressField() {
    return document.querySelector(
      "#address, #propertyAddress, #beachAddress, #addressInput, textarea[name*='address' i], input[name*='address' i], textarea"
    );
  }

  function getAddressText() {
    const el = getAddressField();
    return el ? el.value : "";
  }

  function getCoordsFromGlobals() {
    const possible = [
      window.selectedAddressCoords,
      window.currentAddressCoords,
      window.addressCoords,
      window.geocodedAddress,
      window.lastGeocodedAddress,
      window.lastAddressCoords
    ];

    for (const c of possible) {
      if (!c) continue;

      if (typeof c.lat === "number" && typeof c.lng === "number") return { lat: c.lat, lng: c.lng };
      if (typeof c.latitude === "number" && typeof c.longitude === "number") return { lat: c.latitude, lng: c.longitude };
      if (Array.isArray(c) && c.length >= 2) return { lng: Number(c[0]), lat: Number(c[1]) };

      if (c.center && Array.isArray(c.center)) return { lng: Number(c.center[0]), lat: Number(c.center[1]) };
      if (c.geometry && Array.isArray(c.geometry.coordinates)) return { lng: Number(c.geometry.coordinates[0]), lat: Number(c.geometry.coordinates[1]) };
    }

    return null;
  }

  function approxCoordsFromAddress(address) {
    const a = norm(address);
    const m = a.match(/\b(\d{2,5})\b/);
    const num = m ? parseInt(m[1], 10) : null;

    // Grand Pavilion Blvd / Boardwalk area approximation.
    if (a.includes("grand pavilion")) {
      // 48 Grand Pavilion is east side, closer to Seagrove/Beachwood side.
      // 116 Grand Pavilion is west/central, closer to 58th/Grand Pavilion depending location.
      const n = num || 90;
      const ratio = Math.max(0, Math.min(1, (n - 40) / 100));
      return {
        lat: 32.80495 + ratio * 0.00025,
        lng: -79.74255 - ratio * 0.00205
      };
    }

    // Palm Blvd approximation around 54th-58th.
    if (a.includes("palm")) {
      const n = num || 5700;
      const ratio = Math.max(0, Math.min(1, (n - 5400) / 500));
      return {
        lat: 32.80355 + ratio * 0.00215,
        lng: -79.75110 + ratio * 0.00610
      };
    }

    return null;
  }

  function distanceFeet(a, b) {
    const R = 6371000;
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const lat1 = rad(a.lat);
    const lat2 = rad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h)) * 3.28084;
  }

  function closestAllowedAccess(address) {
    const point = getCoordsFromGlobals() || approxCoordsFromAddress(address);

    // If we can't get coords, fallback based on text, but do NOT use Boardwalk.
    if (!point) {
      const a = norm(address);
      if (a.includes("beachwood") || a.includes("seagrove") || a.includes("48 grand pavilion")) return "Seagrove";
      return "58th Ave Beach Access";
    }

    const allowed = ACCESS_POINTS.filter(p => {
      if (p.blocked && !isBoardwalkInnAddress(address)) return false;
      return true;
    });

    allowed.sort((a, b) => distanceFeet(point, a) - distanceFeet(point, b));
    return allowed[0].name;
  }

  function selectedLooksBoardwalk() {
    const text = norm(document.body ? document.body.innerText : "");
    if (text.includes("selected access") && text.includes("boardwalk inn")) return true;

    const keys = [
      "selectedAccess", "selected_access", "selectedAccessPoint", "selected_access_point",
      "beachAccess", "beach_access", "accessPoint", "access_point",
      "bb_selected_access", "bbSelectedAccess"
    ];

    for (const key of keys) {
      try {
        if (norm(localStorage.getItem(key)).includes("boardwalk inn")) return true;
        if (norm(sessionStorage.getItem(key)).includes("boardwalk inn")) return true;
      } catch(e) {}
    }

    if (norm(window.selectedAccess).includes("boardwalk inn")) return true;
    if (norm(window.selectedAccessPoint).includes("boardwalk inn")) return true;

    return false;
  }

  function setAccess(name) {
    // Update only selected access display pieces, not every map label.
    const selectors = [
      "#selectedAccess",
      "#selected-access",
      "[data-selected-access]",
      ".selected-access",
      ".selectedAccess",
      ".selected-access-value",
      ".access-value",
      "input[name*='selected_access' i]",
      "input[name*='selected' i]",
      "input[name*='access' i]",
      "textarea[name*='access' i]"
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if ("value" in el) {
          el.value = name;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          if (norm(el.textContent).includes("boardwalk") || norm(el.textContent).includes("selected access")) {
            el.textContent = el.textContent.replace(/Boardwalk Inn/gi, name);
          }
        }
      });
    });

    // More careful visible text replacement for the top selected access box.
    document.querySelectorAll("body *").forEach(el => {
      if (el.children.length === 0 && norm(el.textContent).includes("boardwalk inn")) {
        const parentText = norm(el.parentElement ? el.parentElement.innerText : "");
        if (parentText.includes("selected access") || el.closest(".selected-access, .selectedAccess, [data-selected-access]")) {
          el.textContent = el.textContent.replace(/Boardwalk Inn/gi, name);
        }
      }
    });

    window.selectedAccess = name;
    window.selectedAccessPoint = name;
    window.beachAccess = name;

    const keys = [
      "selectedAccess", "selected_access", "selectedAccessPoint", "selected_access_point",
      "beachAccess", "beach_access", "accessPoint", "access_point",
      "bb_selected_access", "bbSelectedAccess"
    ];

    keys.forEach(key => {
      try { localStorage.setItem(key, name); } catch(e) {}
      try { sessionStorage.setItem(key, name); } catch(e) {}
    });

    document.dispatchEvent(new CustomEvent("beachbums:selectedAccessChanged", {
      detail: { selectedAccess: name, source: "closest-except-boardwalk" }
    }));
  }

  function fixIfNeeded() {
    const address = getAddressText();

    if (isBoardwalkInnAddress(address)) return;

    if (selectedLooksBoardwalk()) {
      const replacement = closestAllowedAccess(address);
      setAccess(replacement);
      console.log("[Beach Bums] Boardwalk Inn excluded. Closest allowed access:", replacement);
    }
  }

  let timer;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      fixIfNeeded();
      setTimeout(fixIfNeeded, 120);
      setTimeout(fixIfNeeded, 400);
      setTimeout(fixIfNeeded, 900);
    }, 30);
  }

  ["input", "change", "keyup", "click", "blur"].forEach(evt => {
    document.addEventListener(evt, schedule, true);
  });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Prevent Boardwalk from getting stored for normal addresses.
  ["localStorage", "sessionStorage"].forEach(storeName => {
    try {
      const store = window[storeName];
      const originalSet = store.setItem.bind(store);
      store.setItem = function(key, value) {
        if (norm(value).includes("boardwalk inn") && !isBoardwalkInnAddress(getAddressText())) {
          value = closestAllowedAccess(getAddressText());
        }
        return originalSet(key, value);
      };
    } catch(e) {}
  });

  schedule();
})();
