(function () {
  const orderState = window.BeachBumsOrderState;

  const modal = document.getElementById("lodgingModal");
  const closeBtn = document.getElementById("lodgingClose");
  const houseBtn = document.getElementById("lodgingHouse");
  const condoBtn = document.getElementById("lodgingCondo");

  function setStayType(type) {
    try { localStorage.setItem("bb_stay_type", type); } catch (e) {}
    if (orderState && typeof orderState.beginFresh === "function") {
      orderState.beginFresh({ qty: true, dates: true });
    }
    if (orderState && typeof orderState.set === "function") {
      orderState.set({
        stayType: type,
        chosenAccess: "",
        beachAccess: "",
        deliveryNote: "",
        specialInstructions: "",
        address: "",
        accessSuggestions: []
      });
    }
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  // Day visitors go straight to address/map selection.
  document.getElementById("stay-day")?.addEventListener("click", () => {
    setStayType("day");
    window.location.href = "order-address.html";
  });

  // Overnight users first choose House vs Condo/Hotel/Villa.
  document.getElementById("stay-overnight")?.addEventListener("click", () => {
    openModal();
  });

  // Modal close
  closeBtn?.addEventListener("click", closeModal);
  // Click outside the modal card closes it
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // House path: continue as normal (address entry page)
  houseBtn?.addEventListener("click", () => {
    closeModal();
    setStayType("overnight_house");
    window.location.href = "order-address.html";
  });

  // Condo path: go to condo dropdown flow
  condoBtn?.addEventListener("click", () => {
    closeModal();
    setStayType("overnight_condo");
    window.location.href = "order-condo.html";
  });
})();
