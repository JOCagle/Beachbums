document.addEventListener("DOMContentLoaded", ()=>{
  const order = loadOrder();
  const $ = (s)=>document.querySelector(s);

  $("#firstName").value = order.customer.firstName || "";
  $("#lastName").value = order.customer.lastName || "";
  $("#email").value = order.customer.email || "";
  $("#phone").value = order.customer.phone || "";

  const bind = (id, field)=>$(id).addEventListener("input",(e)=>{order.customer[field]=e.target.value; saveOrder(order);});
  bind("#firstName","firstName");
  bind("#lastName","lastName");
  bind("#email","email");
  bind("#phone","phone");

  $("#backBtn").onclick=()=>location.href="order-address.html";
  $("#nextBtn").onclick=()=>{
    $("#err").textContent = requireContact(order) ? "" : "Enter name, valid email, and phone number.";
    if (!$("#err").textContent){
      saveOrder(order);
      location.href="order-review.html";
    }
  };
});
