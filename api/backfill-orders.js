const { createClient } = require("@supabase/supabase-js");

// ──────────────────────────────────────────────
// Backfill Endpoint — Syncs ALL Booqable orders into Supabase
// Use when orders were missed (e.g. Zapier was down).
//
// Usage:
//   GET /api/backfill-orders?secret=YOUR_CRON_SECRET
//   GET /api/backfill-orders?secret=YOUR_CRON_SECRET&from=2026-04-20&to=2026-05-01
//
// Without from/to params, syncs ALL reserved+started orders.
// With from/to, only syncs orders whose starts_at falls in that range.
// ──────────────────────────────────────────────

const BOOQABLE_SLUG = "beach-bums-chair-umbrella-rental";

module.exports = async function handler(req, res) {
  console.log("backfill-orders triggered", new Date().toISOString());

  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    req.headers["authorization"] !== `Bearer ${cronSecret}` &&
    req.query.secret !== cronSecret
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const booqableApiKey = process.env.BOOQABLE_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Missing Supabase credentials" });
  }
  if (!booqableApiKey) {
    return res.status(500).json({ error: "Missing BOOQABLE_API_KEY" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Optional date range filters
  const fromDate = req.query.from || null; // YYYY-MM-DD
  const toDate = req.query.to || null;     // YYYY-MM-DD

  console.log(`Backfill range: ${fromDate || "all"} to ${toDate || "all"}`);

  try {
    // ──────────────────────────────────────────
    // Step 1: Fetch all orders from Booqable across multiple statuses
    // ──────────────────────────────────────────
    const statuses = ["reserved", "started", "new", "concept"];
    let allOrders = [];

    for (const status of statuses) {
      console.log(`Fetching Booqable orders with status: ${status}...`);
      const orders = await fetchAllOrdersByStatus(booqableApiKey, status);
      console.log(`  Found ${orders.length} orders with status=${status}`);
      allOrders = allOrders.concat(orders);
    }

    // Filter by date range if provided
    if (fromDate || toDate) {
      allOrders = allOrders.filter(order => {
        const startsAt = (order.starts_at || "").substring(0, 10);
        if (!startsAt) return false;
        if (fromDate && startsAt < fromDate) return false;
        if (toDate && startsAt > toDate) return false;
        return true;
      });
      console.log(`After date filter: ${allOrders.length} orders`);
    }

    // Deduplicate by order ID (same order might appear in multiple status queries)
    const uniqueMap = new Map();
    allOrders.forEach(order => {
      if (order.id) uniqueMap.set(order.id, order);
    });
    allOrders = Array.from(uniqueMap.values());

    console.log(`Total unique orders to process: ${allOrders.length}`);

    if (allOrders.length === 0) {
      return res.status(200).json({
        message: "No orders found in Booqable for the given range",
        synced: 0,
        skipped: 0,
        errors: 0,
      });
    }

    // ──────────────────────────────────────────
    // Step 2: For each order, check Supabase and upsert if missing
    // ──────────────────────────────────────────
    let synced = 0;
    let skipped = 0;
    let updated = 0;
    let errors = 0;

    for (const order of allOrders) {
      const orderNumber = String(order.number || "");
      if (!orderNumber) {
        console.log(`Skipping order with no number (ID: ${order.id})`);
        skipped++;
        continue;
      }

      const orderId = `BQ-${orderNumber}`;

      try {
        // Check if already in Supabase
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("order_id", orderId)
          .limit(1);

        const isExisting = existing && existing.length > 0;

        // Fetch line items from v4 API
        let lineItems = [];
        try {
          lineItems = await fetchOrderLines(order.id, booqableApiKey);
        } catch (e) {
          console.error(`Failed to fetch lines for ${orderId}:`, e.message);
        }

        // Extract data
        const customer = order.customer || {};
        const customerName = customer.name ||
          [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "";
        const customerEmail = customer.email || "";
        const customerPhone =
          customer.phone ||
          (customer.properties_attributes && customer.properties_attributes.phone) ||
          "";

        const props = order.properties_attributes || {};
        const accessPoint =
          props.selected_access_point ||
          props.beach_location ||
          props.access_point ||
          props.beach_access ||
          "";
        const specialInstructions =
          props.special_instructions ||
          props.additional_info ||
          props.address ||
          props.notes ||
          "";

        const formattedItems = lineItems
          .filter(line => {
            const name = (line.title || line.name || "").toLowerCase();
            return !name.includes("bundle");
          })
          .map(line => ({
            name: line.title || line.name || "Unknown",
            quantity: line.quantity || 1,
          }));

        const startsAt = order.starts_at || "";
        const stopsAt = order.stops_at || "";
        const deliveryDate = startsAt ? startsAt.substring(0, 10) : null;
        const endDate = stopsAt ? stopsAt.substring(0, 10) : null;

        const totalCents =
          order.grand_total_with_tax_in_cents || order.amount_in_cents || 0;

        const row = {
          order_id: orderId,
          delivery_date: deliveryDate,
          end_date: endDate,
          customer_name: customerName || null,
          email: customerEmail || null,
          phone: customerPhone || null,
          address: specialInstructions || null,
          access_point: accessPoint || null,
          items: formattedItems.length > 0 ? formattedItems : null,
          total: totalCents / 100,
          logo_url: "/assets/logo.webp",
          printed: false,
        };

        if (isExisting) {
          // Update existing — don't overwrite print tracking
          delete row.printed;
          const { error: updateErr } = await supabase
            .from("orders")
            .update(row)
            .eq("order_id", orderId);

          if (updateErr) {
            console.error(`Update error for ${orderId}:`, updateErr.message);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Insert new
          console.log(`Inserting missing order: ${orderId} — ${customerName}`);
          const { error: insertErr } = await supabase
            .from("orders")
            .insert([row]);

          if (insertErr) {
            console.error(`Insert error for ${orderId}:`, insertErr.message);
            errors++;
          } else {
            synced++;
          }
        }
      } catch (e) {
        console.error(`Error processing order ${orderId}:`, e.message);
        errors++;
      }
    }

    console.log(`Backfill complete: synced=${synced}, updated=${updated}, skipped=${skipped}, errors=${errors}`);
    return res.status(200).json({
      message: "Backfill complete",
      newOrdersSynced: synced,
      existingOrdersUpdated: updated,
      skipped,
      errors,
      totalProcessed: allOrders.length,
    });
  } catch (err) {
    console.error("backfill-orders error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ──────────────────────────────────────────────
// Fetch ALL orders from Booqable v1 API with a given status
// Paginates through all results
// ──────────────────────────────────────────────
async function fetchAllOrdersByStatus(apiKey, status) {
  const allOrders = [];
  let page = 1;
  const perPage = 50;
  let totalPages = 1;

  while (page <= totalPages) {
    const url =
      `https://${BOOQABLE_SLUG}.booqable.com/api/1/orders` +
      `?api_key=${apiKey}&status=${status}&per=${perPage}&page=${page}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error(`Booqable API error (status=${status}, page=${page}):`, res.status);
      break;
    }

    const data = await res.json();
    const orders = data.orders || [];
    const totalCount = data.meta?.total_count || 0;
    totalPages = Math.ceil(totalCount / perPage);

    allOrders.push(...orders);
    page++;

    // Safety limit
    if (page > 200) {
      console.warn(`Hit 200-page safety limit for status=${status}`);
      break;
    }
  }

  return allOrders;
}

// ──────────────────────────────────────────────
// Fetch line items for a specific order using Booqable v4 API
// ──────────────────────────────────────────────
async function fetchOrderLines(booqableOrderId, apiKey) {
  const url =
    `https://${BOOQABLE_SLUG}.booqable.com/api/4/orders/${booqableOrderId}` +
    `?include=lines&fields[orders]=number&fields[lines]=title,quantity`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    console.error("v4 lines fetch failed:", res.status);
    return [];
  }

  const data = await res.json();
  return (data.included || [])
    .filter(inc => inc.type === "lines")
    .map(inc => inc.attributes);
}
