document.addEventListener("DOMContentLoaded", ()=>{
  const order = loadOrder();

  const $ = (s)=>document.querySelector(s);
  const setQty = ()=>{
    $("#chairsQty").textContent = order.qty.chairs;
    $("#umbrellasQty").textContent = order.qty.umbrellas;
    $("#coolersQty").textContent = order.qty.coolers;
  };

  const bump = (k, d)=>{
    order.qty[k] = Math.max(0, Number(order.qty[k]||0) + d);
    saveOrder(order);
    setQty();
  };

  $("#chairsMinus").onclick=()=>bump("chairs",-1);
  $("#chairsPlus").onclick=()=>bump("chairs",+1);
  $("#umbMinus").onclick=()=>bump("umbrellas",-1);
  $("#umbPlus").onclick=()=>bump("umbrellas",+1);
  $("#coolMinus").onclick=()=>bump("coolers",-1);
  $("#coolPlus").onclick=()=>bump("coolers",+1);

  $("#nextBtn").onclick=()=>{
    const msg = requireMinOneItem(order) ? "" : "Select at least one item.";
    $("#err").textContent = msg;
    if (!msg){
      saveOrder(order);
      location.href = "order-review.html";
    }
  };

  setQty();
});
