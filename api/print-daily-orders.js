const { createClient } = require("@supabase/supabase-js");
const PDFDocument = require("pdfkit");

// ──────────────────────────────────────────────
// Geographic order of beach access points (SW → NE along Isle of Palms)
// Used to sort the daily manifest so crew drives one direction down the beach.
// Matching is fuzzy: we lowercase the order's access_point and check if it
// contains any of these keys. Order: 5th Ave end → 55th Ave end.
// ──────────────────────────────────────────────
const ACCESS_POINT_ORDER = [
  // === Southwest end of island ===
  "5th ave",
  "6th ave",
  "7th ave",
  "8th ave",
  "9th ave",
  "9a ave",
  // === Front Beach / Pavilion area (SW to NE along Ocean Blvd) ===
  "dunescape",
  "windjammer",
  "seaside inn",
  "ocean palms",
  "1116 ocean",
  "coconut joe",
  "palms hotel",
  "pavilion",
  "1140 ocean",
  "seascape",
  "ocean club",
  "sea cabin",
  "sand dune",
  // === Mid-island numbered avenues ===
  "21st ave",
  "tidewater",
  "summer house",
  "22nd ave",
  "23rd ave",
  "24th ave",
  "25th ave",
  "26th ave",
  "27th ave",
  "28th ave",
  "29th ave",
  "30th ave",
  "30a ave",
  "31st ave",
  "31a ave",
  "32nd ave",
  "32a ave",
  "33rd ave",
  "33a ave",
  "34th ave",
  "34a ave",
  "35th ave",
  "35a ave",
  "36th ave",
  "36a ave",
  "37th ave",
  "37a ave",
  "38th ave",
  "39th ave",
  "40th ave",
  "41st ave",
  "42nd ave",
  "43rd ave",
  "44th ave",
  "45th ave",
  "46th ave",
  "47th ave",
  "48th ave",
  "49th ave",
  "50th ave",
  "51st ave",
  "52nd ave",
  "53rd ave",
  "54th ave",
  "55th ave",
  // === Far northeast end (Wild Dunes / condo complexes) ===
  "seagrove",
  "56th ave",
  "57th ave",
  "58th ave",
  "boardwalk inn",
  "fairway dunes",
  "shipwatch",
  "port o",
  "beach club villa",
  "mariners walk",
];

function getAccessPointSortIndex(accessPoint) {
  if (!accessPoint) return ACCESS_POINT_ORDER.length;
  const normalized = String(accessPoint).toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < ACCESS_POINT_ORDER.length; i++) {
    if (normalized.includes(ACCESS_POINT_ORDER[i])) return i;
  }
  return ACCESS_POINT_ORDER.length; // Unknown access points go at the end
}

// ──────────────────────────────────────────────
// Vercel Serverless Function — triggered by cron-job.org daily
// Expected cron time: 3:00 AM Eastern (07:00 UTC summer / 08:00 UTC winter)
// The sync-booqable-orders job runs at 2:45 AM ET to populate Supabase first.
// ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const nowUTC = new Date();
  const etString = nowUTC.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etString);
  const etHour = etDate.getHours();
  const etMinute = etDate.getMinutes();

  console.log("═══════════════════════════════════════════");
  console.log("print-daily-orders TRIGGERED");
  console.log(`  UTC time : ${nowUTC.toISOString()}`);
  console.log(`  ET time  : ${etString} (hour=${etHour})`);
  console.log("═══════════════════════════════════════════");

  // ── Auth check ──
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    req.headers["authorization"] !== `Bearer ${cronSecret}` &&
    req.query.secret !== cronSecret
  ) {
    console.log("REJECTED: Unauthorized request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Time-of-day guard ──
  // Only allow printing between 2 AM and 7 AM Eastern to prevent afternoon reprints.
  // Pass ?force=true to override (for manual testing / emergencies).
  const forceOverride = req.query.force === "true";
  if (!forceOverride && (etHour < 2 || etHour >= 7)) {
    console.log(`BLOCKED: Outside print window (ET hour = ${etHour}). Use ?force=true to override.`);
    return res.status(200).json({
      message: "Outside print window (2 AM – 7 AM ET). No action taken.",
      etTime: etString,
      etHour,
      hint: "Add ?force=true to override this guard."
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const printNodeApiKey = process.env.PRINTNODE_API_KEY;
  const printNodePrinterId = process.env.PRINTNODE_PRINTER_ID;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    return res.status(500).json({ error: "Missing Supabase credentials" });
  }

  if (!printNodeApiKey || !printNodePrinterId) {
    console.error("Missing PrintNode credentials (PRINTNODE_API_KEY or PRINTNODE_PRINTER_ID)");
    return res.status(500).json({ error: "Missing PrintNode credentials" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  console.log("Looking for orders with delivery_date =", today);

  // ── Query & filter orders ──
  let orders = await queryAndFilterOrders(supabase, today);

  // ── Retry once if 0 orders found ──
  // The sync-booqable-orders job runs at 2:45 AM. If it hasn't finished
  // populating Supabase by the time this fires, we wait and try again.
  if (orders.length === 0) {
    console.log("0 orders found on first attempt. Waiting 90 seconds for sync to finish...");
    await sleep(90000);
    orders = await queryAndFilterOrders(supabase, today);
    if (orders.length === 0) {
      console.log("Still 0 orders after retry. Nothing to print.");
      return res.status(200).json({ message: "No orders to print.", count: 0, retried: true });
    }
    console.log(`Retry found ${orders.length} order(s).`);
  }

  console.log(`Found ${orders.length} order(s) to print.`);
  let printedCount = 0;

  for (const order of orders) {
    // --------------------------------------------------------------------------
    // DISABLED: Printing individual order tickets paused per user request
    // --------------------------------------------------------------------------
    /*
    const pdfBuffer = await buildPrintPdf(order, today);
    try {
      await sendPdfToPrintNode({
        apiKey: printNodeApiKey,
        printerId: Number(printNodePrinterId),
        title: `Beach Bums Order — ${order.order_id || order.id}`,
        pdfBuffer,
      });
      console.log(`Printed order ${order.order_id || order.id}`);
    } catch (printErr) {
      console.error(`PrintNode error for order ${order.order_id}:`, printErr.message || printErr);
      continue;
    }
    */

    printedCount++;
  }

  if (printedCount > 0) {
    // Sort orders geographically (5th Ave → 55th Ave) for the route manifest
    orders.sort((a, b) => getAccessPointSortIndex(a.access_point) - getAccessPointSortIndex(b.access_point));

    const manifestPdfBuffer = await buildManifestPdf(orders, today);
    try {
      await sendPdfToPrintNode({
        apiKey: printNodeApiKey,
        printerId: Number(printNodePrinterId),
        title: `Beach Bums Daily Manifest — ${today}`,
        pdfBuffer: manifestPdfBuffer,
      });
      console.log(`Printed Daily Manifest for ${today}`);
      
      // Update Supabase to record that these orders were printed today
      const printedOrderIds = orders.map(o => o.id);
      const { error: updateError } = await supabase
        .from("orders")
        .update({ last_printed_date: today, printed: true })
        .in("id", printedOrderIds);

      if (updateError) {
         console.error("Failed to update last_printed_date in Supabase:", updateError.message);
      } else {
         console.log(`Successfully updated last_printed_date for ${printedOrderIds.length} orders.`);
      }
      
    } catch (printErr) {
      console.error(`PrintNode error for Daily Manifest:`, printErr.message || printErr);
    }
  }

  return res.status(200).json({ printed: printedCount, total: orders.length });
};

// ──────────────────────────────────────────────
// Query Supabase for today's printable orders
// ──────────────────────────────────────────────
async function queryAndFilterOrders(supabase, today) {
  const { data: candidateOrders, error } = await supabase
    .from("orders")
    .select("*")
    .lte("delivery_date", today)
    .or(`end_date.gte.${today},end_date.is.null`);

  if (error) {
    console.error("Supabase query error:", error.message);
    return [];
  }

  console.log(`  Supabase returned ${(candidateOrders || []).length} candidate order(s)`);

  let orders = (candidateOrders || []).filter(o => {
    // If it already printed today, do not print again
    if (o.last_printed_date === today) return false;

    if (!o.end_date) return o.delivery_date === today;
    return true;
  });

  console.log(`  After filtering: ${orders.length} order(s) qualify`);

  // Deduplicate: If multiple rows have the same order_id, only keep one
  const uniqueOrdersMap = new Map();
  orders.forEach(order => {
    const key = order.order_id || order.id;
    uniqueOrdersMap.set(key, order);
  });
  orders = Array.from(uniqueOrdersMap.values());

  console.log(`  After dedup: ${orders.length} unique order(s)`);
  return orders;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────
// Parse Dynamic Array Packages into Raw Totals
// ──────────────────────────────────────────────
function parseGearTotals(items) {
  let chairs = 0; let umbrellas = 0; let coolers = 0;
  const otherItems = [];

  if (!Array.isArray(items)) {
    return { chairs: items.chairs||0, umbrellas: items.umbrellas||0, coolers: items.coolers||0, otherItems };
  }

  items.forEach(item => {
    const q = Number(item.quantity) || 1;
    const nm = String(item.name || "").toLowerCase();
    let matched = false;

    // Ignore bundle package names to prevent double-counting.
    // Booqable sends the bundle parents AND the physical child components.
    if (nm.includes("bundle")) return;

    let itemChairs = 0; let itemUmbrellas = 0; let itemCoolers = 0;

    const cMatch = nm.match(/(\d+)\s*chair/);
    if (cMatch) { itemChairs += Number(cMatch[1]) * q; matched = true; }
    else if (nm.includes("chair")) { itemChairs += q; matched = true; }

    const uMatch = nm.match(/(\d+)\s*umbrella/);
    if (uMatch) { itemUmbrellas += Number(uMatch[1]) * q; matched = true; }
    else if (nm.includes("umbrella")) { itemUmbrellas += q; matched = true; }

    const coMatch = nm.match(/(\d+)\s*cooler/);
    if (coMatch) { itemCoolers += Number(coMatch[1]) * q; matched = true; }
    else if (nm.includes("cooler")) { itemCoolers += q; matched = true; }

    if (matched) {
      chairs += itemChairs;
      umbrellas += itemUmbrellas;
      coolers += itemCoolers;
    } else {
      otherItems.push({ name: item.name, quantity: q });
    }
  });

  return { chairs, umbrellas, coolers, otherItems };
}

// ──────────────────────────────────────────────
// Utility: Strip year from date (YYYY-MM-DD -> MM-DD)
// ──────────────────────────────────────────────
function formatShortDate(dateStr) {
  if (!dateStr || dateStr === "—") return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.substring(5);
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr.substring(0, 5);
  if (dateStr.length >= 8 && dateStr.includes("202")) return dateStr.replace(/[-/]\d{4}/, "");
  return dateStr;
}

// ──────────────────────────────────────────────
// Build Individual Order Ticket PDF
// ──────────────────────────────────────────────
async function buildPrintPdf(order, today) {
  return new Promise(async (resolve, reject) => {
    // 240 x 400 is roughly phone sized (3.3 x 5.5 inches)
    const doc = new PDFDocument({ margin: 20, size: [240, 400] });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const parsedItems = parseGearTotals(order.items || {});
    const deliveryDate = formatShortDate(order.delivery_date || "—");
    const endDate = formatShortDate(order.end_date || "—");
    const customerName = order.customer_name || "—";
    const accessPoint = order.access_point || "—";

    // 1. Fetch & Embed Logo
    try {
      const logoRes = await fetch("https://www.beachbumsiop.com/assets/android-chrome-512x512.png");
      if (logoRes.ok) {
        const logoArrayBuffer = await logoRes.arrayBuffer();
        doc.image(logoArrayBuffer, 88, 20, { width: 64 });
        doc.moveDown(5); 
      } else {
        doc.moveDown(2);
      }
    } catch(e) {
      console.error("Failed to load logo", e);
      doc.moveDown(2);
    }

    // 2. Customer Name
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a1a').text(customerName, { align: 'center' });
    doc.moveDown(0.25);
    
    // 3. Access Point
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a8fd1').text(accessPoint, { align: 'center' });
    doc.moveDown(1);

    // 4. Dates without header
    doc.fontSize(12).font('Helvetica').fillColor('#1a1a1a').text(`${deliveryDate} \u2014 ${endDate}`, { align: 'center' });
    doc.moveDown(1);

    // 5. Gear Summary without header
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a');
    
    let hasGear = false;
    if (parsedItems.chairs) { doc.text(`${parsedItems.chairs}x Chairs`, { align: 'center' }); hasGear = true; }
    if (parsedItems.umbrellas) { doc.text(`${parsedItems.umbrellas}x Umbrellas`, { align: 'center' }); hasGear = true; }
    if (parsedItems.coolers) { doc.text(`${parsedItems.coolers}x Coolers`, { align: 'center' }); hasGear = true; }
    parsedItems.otherItems.forEach(item => {
      doc.text(`${item.quantity}x ${item.name}`, { align: 'center' });
      hasGear = true;
    });

    if (!hasGear) doc.text("—", { align: 'center' });
    doc.moveDown(1);

    // 6. Special Instructions without header
    const specialInstructions = order.address || "";
    if (specialInstructions && specialInstructions.length > 0) {
      doc.fontSize(12).font('Helvetica').fillColor('#1a1a1a').text(specialInstructions, { align: 'center' });
      doc.moveDown(1);
    }

    // Footer
    doc.fontSize(8).fillColor('#bbbbbb').text(`Beach Bums IOP • ${today}`, { align: 'center' });

    doc.end();
  });
}

// ──────────────────────────────────────────────
// Build Spreadsheet-style Daily Manifest PDF
// ──────────────────────────────────────────────
async function buildManifestPdf(orders, today) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a8fd1').text('Daily Route Manifest');
    doc.fontSize(12).font('Helvetica').fillColor('#666666').text(`Delivery Date: ${today}  |  Total Orders: ${orders.length}`);
    doc.moveDown(1.5);

    const headers = ['Customer', 'Access Point', 'Items', 'Instructions'];
    let y = doc.y;

    // Draw Headers
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a1a');
    doc.text(headers[0], 30, y, { width: 130 });
    doc.text(headers[1], 170, y, { width: 170 });
    doc.text(headers[2], 350, y, { width: 230 });
    doc.text(headers[3], 590, y, { width: 220 });
    y += 15;
    
    doc.moveTo(30, y).lineTo(810, y).stroke();
    y += 10;

    doc.font('Helvetica');
    orders.forEach(order => {
      const parsedItems = parseGearTotals(order.items || {});
      const name = order.customer_name || "—";
      const access = order.access_point || "—";
      const instructions = order.address || "—";
      
      const parts = [];
      if (parsedItems.chairs) parts.push(`${parsedItems.chairs}x Chairs`);
      if (parsedItems.umbrellas) parts.push(`${parsedItems.umbrellas}x Umbrellas`);
      if (parsedItems.coolers) parts.push(`${parsedItems.coolers}x Coolers`);
      parsedItems.otherItems.forEach(i => parts.push(`${i.quantity}x ${i.name}`));
      const itemsStr = parts.join(", ") || "—";
      
      const height = Math.max(
        doc.heightOfString(name, { width: 130 }),
        doc.heightOfString(access, { width: 170 }),
        doc.heightOfString(itemsStr, { width: 230 }),
        doc.heightOfString(instructions, { width: 220 })
      );

      doc.text(name, 30, y, { width: 130 });
      doc.text(access, 170, y, { width: 170 });
      doc.text(itemsStr, 350, y, { width: 230 });
      doc.text(instructions, 590, y, { width: 220 });
      
      y += height + 10;
      doc.moveTo(30, y - 5).lineTo(810, y - 5).strokeColor('#eeeeee').stroke();

      if (y > 520) {
        doc.addPage({ margin: 30, layout: 'landscape' });
        y = 40;
      }
    });

    doc.end();
  });
}

// ──────────────────────────────────────────────
// Send PDF to PrintNode
// ──────────────────────────────────────────────
async function sendPdfToPrintNode({ apiKey, printerId, title, pdfBuffer }) {
  const body = JSON.stringify({
    printerId,
    title,
    contentType: "pdf_base64",
    content: pdfBuffer.toString("base64"),
    source: "Beach Bums Auto-Print",
  });

  const resp = await fetch("https://api.printnode.com/printjobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`PrintNode API ${resp.status}: ${errText}`);
  }

  return resp.json();
}


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
