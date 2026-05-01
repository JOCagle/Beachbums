
/* =========================================================
   1400 OCEAN BLVD + OCEANFRONT MODAL FIX
   - 1400 Ocean Blvd is NOT oceanfront.
   - 1400 Ocean Blvd recommends Sea Cabins A.
   - Oceanfront message is centered/visible, not stuck at page bottom.
   ========================================================= */
(function(){
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

  function is1400OceanBlvd(address){
    const a = norm(address);
    return /\b1400\b/.test(a) && (a.includes("ocean blvd") || a.includes("ocean boulevard"));
  }

  function isOceanBlvd(address){
    const a = norm(address);
    return a.includes("ocean blvd") || a.includes("ocean boulevard");
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
          const text = norm(el.textContent);
          if (text.includes("selected access") || text.includes("1400 ocean") || text.includes("boardwalk") || text.includes("oceanfront")) {
            el.textContent = el.textContent.replace(/1400 ocean blvd/gi, name)
                                           .replace(/Boardwalk Inn/gi, name)
                                           .replace(/Oceanfront delivery/gi, name);
          }
        }
      });
    });

    /* Replace the right-side value in the selected access box if it is plain text */
    document.querySelectorAll("body *").forEach(el => {
      if (el.children.length === 0) {
        const t = norm(el.textContent);
        const parent = norm(el.parentElement ? el.parentElement.innerText : "");
        if (parent.includes("selected access") && (t.includes("1400 ocean") || t.includes("ocean blvd") || t.includes("boardwalk"))) {
          el.textContent = name;
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

    keys.forEach(k => {
      try { localStorage.setItem(k, name); } catch(e){}
      try { sessionStorage.setItem(k, name); } catch(e){}
    });

    document.dispatchEvent(new CustomEvent("beachbums:selectedAccessChanged", {
      detail: { selectedAccess:name, source:"1400-ocean-fix" }
    }));
  }

  function selectedAccessText(){
    const body = norm(document.body ? document.body.innerText : "");
    const keys = [
      "selectedAccess", "selected_access", "selectedAccessPoint", "selected_access_point",
      "beachAccess", "beach_access", "accessPoint", "access_point",
      "bb_selected_access", "bbSelectedAccess"
    ];
    let stored = "";
    keys.forEach(k => {
      try { stored += " " + (localStorage.getItem(k) || "") + " " + (sessionStorage.getItem(k) || ""); } catch(e){}
    });
    return body + " " + norm(stored) + " " + norm(window.selectedAccess) + " " + norm(window.selectedAccessPoint);
  }

  function closeOceanfrontModalIf1400(){
    if (!is1400OceanBlvd(getAddress())) return;

    const modalSelectors = [
      "#oceanfront-modal",
      "#oceanfrontModal",
      "#frontBeachModal",
      ".oceanfront-modal",
      ".front-beach-modal",
      ".modal",
      "[role='dialog']"
    ];

    modalSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (norm(el.innerText).includes("oceanfront") || norm(el.innerText).includes("ocean front")) {
          el.style.display = "none";
          el.setAttribute("aria-hidden", "true");
          el.classList.remove("show", "open", "active");
        }
      });
    });

    document.querySelectorAll(".modal-backdrop, .bb-modal-overlay, .overlay").forEach(el => {
      if (norm(el.innerText).includes("oceanfront") || norm(el.innerText).includes("ocean front") || el.id.toLowerCase().includes("ocean")) {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
        el.classList.remove("show", "open", "active");
      }
    });

    document.body.classList.remove("modal-open", "oceanfront-open", "front-beach-open");
  }

  function fix1400Ocean(){
    const address = getAddress();
    if (!is1400OceanBlvd(address)) return;

    setSelectedAccess("Sea Cabins A");
    closeOceanfrontModalIf1400();
  }

  function fixOceanfrontModalPosition(){
    /*
      IMPORTANT:
      #oceanfrontModal is the FULL SCREEN OVERLAY, not the small dialog card.
      The old patch accidentally centered the overlay itself, which made the
      oceanfront message look stuck in the top-left corner. This keeps the
      overlay fullscreen and only centers the inner .bb-modal card.
    */
    const overlays = Array.from(document.querySelectorAll(
      "#oceanfrontModal, #oceanfront-modal, #frontBeachModal, .bb-modal-overlay, .modal-backdrop, .overlay, #oceanfront-modal-overlay, #frontBeachModalOverlay"
    ));

    overlays.forEach(overlay => {
      const text = norm(overlay.innerText);
      const id = norm(overlay.id);
      if (text.includes("oceanfront") || text.includes("ocean front") || id.includes("oceanfront") || id.includes("frontbeach")) {
        overlay.classList.remove("bb-oceanfront-modal-fixed");
        overlay.classList.add("bb-oceanfront-overlay-fixed");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.right = "0";
        overlay.style.bottom = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.maxWidth = "none";
        overlay.style.transform = "none";
        overlay.style.margin = "0";
        overlay.style.zIndex = "999998";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
      }
    });

    const modalCandidates = Array.from(document.querySelectorAll(
      "#oceanfrontModal > .bb-modal, #oceanfront-modal > .bb-modal, #frontBeachModal > .bb-modal, .oceanfront-modal, .front-beach-modal, [role='dialog']"
    ));

    modalCandidates.forEach(modal => {
      const text = norm(modal.innerText);
      if (!text.includes("oceanfront") && !text.includes("ocean front")) return;

      modal.classList.add("bb-oceanfront-modal-fixed");
      modal.style.position = "relative";
      modal.style.left = "auto";
      modal.style.top = "auto";
      modal.style.right = "auto";
      modal.style.bottom = "auto";
      modal.style.transform = "none";
      modal.style.zIndex = "999999";
      modal.style.maxWidth = "min(640px, calc(100vw - 32px))";
      modal.style.width = "min(640px, calc(100vw - 32px))";
      modal.style.margin = "0 auto";
    });
  }

  function prevent1400OceanFromBeingOceanfront(){
    const address = getAddress();

    if (is1400OceanBlvd(address)) {
      fix1400Ocean();
      return;
    }

    /* For real oceanfront addresses, only fix modal placement */
    if (isOceanBlvd(address)) {
      fixOceanfrontModalPosition();
    }
  }

  let timer;
  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      prevent1400OceanFromBeingOceanfront();
      setTimeout(prevent1400OceanFromBeingOceanfront, 120);
      setTimeout(prevent1400OceanFromBeingOceanfront, 400);
      setTimeout(prevent1400OceanFromBeingOceanfront, 900);
    }, 30);
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

  /* Prevent 1400 Ocean from being saved as access or oceanfront */
  ["localStorage","sessionStorage"].forEach(storeName => {
    try {
      const store = window[storeName];
      const oldSet = store.setItem.bind(store);
      store.setItem = function(key, value){
        if (is1400OceanBlvd(getAddress())) {
          const k = norm(key);
          const v = norm(value);
          if (k.includes("access") || v.includes("1400 ocean") || v.includes("oceanfront") || v.includes("ocean front")) {
            value = "Sea Cabins A";
          }
        }
        return oldSet(key, value);
      };
    } catch(e){}
  });

  schedule();
})();
