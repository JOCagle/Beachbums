
/* =========================================================
   1400 OCEAN BLVD 100FT RADIUS FIX
   Anything at/near 1400 Ocean Blvd within ~100 feet goes to Sea Cabins A.
   It is NOT oceanfront and should NOT show the oceanfront modal.
   ========================================================= */
(function(){
  const SEA_CABINS_A = "Sea Cabins A";

  // Approx point for 1400 Ocean Blvd / Sea Cabins area.
  const CENTER_1400_OCEAN = {
    lat: 32.78695,
    lng: -79.78935
  };

  const RADIUS_FEET = 100;

  function norm(v){
    return String(v || "")
      .toLowerCase()
      .replace(/[.,#]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getAddressField(){
    return document.querySelector(
      "#address, #propertyAddress, #beachAddress, #addressInput, textarea[name*='address' i], input[name*='address' i], textarea"
    );
  }

  function getAddress(){
    const el = getAddressField();
    return el ? el.value : "";
  }

  function distanceFeet(a, b){
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

  function getCoordsFromGlobals(){
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

  function looksLike1400OceanText(address){
    const a = norm(address);
    return (
      /\b1400\b/.test(a) &&
      (a.includes("ocean") || a.includes("ocean blvd") || a.includes("ocean boulevard"))
    );
  }

  function isWithin1400OceanRadius(address){
    if (looksLike1400OceanText(address)) return true;

    const coords = getCoordsFromGlobals();
    if (!coords) return false;

    return distanceFeet(coords, CENTER_1400_OCEAN) <= RADIUS_FEET;
  }

  function setSelectedAccess(name){
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
          el.dispatchEvent(new Event("input", { bubbles:true }));
          el.dispatchEvent(new Event("change", { bubbles:true }));
        } else {
          const parentText = norm(el.parentElement ? el.parentElement.innerText : "");
          if (
            parentText.includes("selected access") ||
            norm(el.textContent).includes("1400 ocean") ||
            norm(el.textContent).includes("oceanfront") ||
            norm(el.textContent).includes("ocean front")
          ) {
            el.textContent = name;
          }
        }
      });
    });

    // More direct selected access panel text replacement.
    document.querySelectorAll("body *").forEach(el => {
      if (el.children.length === 0) {
        const text = norm(el.textContent);
        const parent = norm(el.parentElement ? el.parentElement.innerText : "");
        if (
          parent.includes("selected access") &&
          (
            text.includes("1400 ocean") ||
            text.includes("ocean blvd") ||
            text.includes("oceanfront") ||
            text.includes("ocean front") ||
            text.includes("boardwalk")
          )
        ) {
          el.textContent = name;
        }
      }
    });

    window.selectedAccess = name;
    window.selectedAccessPoint = name;
    window.beachAccess = name;
    window.isOceanfront = false;
    window.isFrontBeach = false;

    const keys = [
      "selectedAccess", "selected_access", "selectedAccessPoint", "selected_access_point",
      "beachAccess", "beach_access", "accessPoint", "access_point",
      "bb_selected_access", "bbSelectedAccess"
    ];

    keys.forEach(k => {
      try { localStorage.setItem(k, name); } catch(e){}
      try { sessionStorage.setItem(k, name); } catch(e){}
    });

    // Also clear possible oceanfront flags.
    ["isOceanfront","isFrontBeach","oceanfront","frontBeach","bb_is_oceanfront"].forEach(k => {
      try { localStorage.setItem(k, "false"); } catch(e){}
      try { sessionStorage.setItem(k, "false"); } catch(e){}
    });

    document.dispatchEvent(new CustomEvent("beachbums:selectedAccessChanged", {
      detail: { selectedAccess:name, source:"1400-ocean-100ft-radius" }
    }));
  }

  function hideOceanfrontModal(){
    document.querySelectorAll(
      "#oceanfront-modal, #oceanfrontModal, #frontBeachModal, .oceanfront-modal, .front-beach-modal, [role='dialog'], .modal"
    ).forEach(el => {
      const t = norm(el.innerText);
      if (t.includes("oceanfront") || t.includes("ocean front")) {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
        el.classList.remove("show", "open", "active");
      }
    });

    document.querySelectorAll(".modal-backdrop, .bb-modal-overlay, .overlay").forEach(el => {
      const t = norm(el.innerText + " " + el.id + " " + el.className);
      if (t.includes("oceanfront") || t.includes("ocean front")) {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
        el.classList.remove("show", "open", "active");
      }
    });

    document.body.classList.remove("modal-open", "oceanfront-open", "front-beach-open");
  }

  function fix1400Radius(){
    const address = getAddress();

    if (!isWithin1400OceanRadius(address)) return;

    setSelectedAccess(SEA_CABINS_A);
    hideOceanfrontModal();

    console.log("[Beach Bums] 1400 Ocean Blvd radius rule applied: Sea Cabins A");
  }

  let timer;
  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      fix1400Radius();
      setTimeout(fix1400Radius, 100);
      setTimeout(fix1400Radius, 350);
      setTimeout(fix1400Radius, 900);
      setTimeout(fix1400Radius, 1500);
    }, 25);
  }

  ["input","change","keyup","click","blur"].forEach(evt => {
    document.addEventListener(evt, schedule, true);
  });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList:true,
    subtree:true,
    characterData:true,
    attributes:true
  });

  // Prevent any storage write from saving 1400 area as oceanfront.
  ["localStorage","sessionStorage"].forEach(storeName => {
    try {
      const store = window[storeName];
      const oldSet = store.setItem.bind(store);

      store.setItem = function(key, value){
        if (isWithin1400OceanRadius(getAddress())) {
          const k = norm(key);
          const v = norm(value);
          if (
            k.includes("access") ||
            k.includes("ocean") ||
            k.includes("front") ||
            v.includes("1400 ocean") ||
            v.includes("oceanfront") ||
            v.includes("ocean front")
          ) {
            if (k.includes("access")) value = SEA_CABINS_A;
            if (k.includes("ocean") || k.includes("front")) value = "false";
          }
        }
        return oldSet(key, value);
      };
    } catch(e){}
  });

  schedule();
})();
