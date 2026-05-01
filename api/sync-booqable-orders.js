const { createClient } = require("@supabase/supabase-js");

// ──────────────────────────────────────────────
// Booqable → Supabase Daily Sync (Safety Net)
// Runs at 2:45 AM ET via cron-job.org, 15 min before the print job.
// Pulls all reserved orders from Booqable that start today,
// and upserts any that are missing from Supabase.
// ──────────────────────────────────────────────

const BOOQABLE_SLUG = "beach-bums-chair-umbrella-rental";

module.exports = async function handler(req, res) {
  console.log("sync-booqable-orders triggered", new Date().toISOString());

  // Auth check (same CRON_SECRET as print-daily-orders)
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
    console.error("Missing Supabase credentials");
    return res.status(500).json({ error: "Missing Supabase credentials" });
  }
  if (!booqableApiKey) {
    console.error("Missing BOOQABLE_API_KEY");
    return res.status(500).json({ error: "Missing BOOQABLE_API_KEY" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get today's date in Eastern time
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  console.log("Syncing orders for date:", today);

  try {
    // ──────────────────────────────────────────
    // Step 1: Fetch ALL reserved orders from Booqable
    // We paginate through all of them and find ones starting today
    // ──────────────────────────────────────────
    const todayOrders = await fetchTodaysOrders(booqableApiKey, today);
    console.log(`Found ${todayOrders.length} order(s) starting today in Booqable`);

    if (todayOrders.length === 0) {
      return res.status(200).json({
        message: "No orders starting today in Booqable",
        synced: 0,
        skipped: 0,
      });
    }

    // ──────────────────────────────────────────
    // Step 2: For each order, check if it already exists in Supabase
    // ──────────────────────────────────────────
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of todayOrders) {
      const orderId = `BQ-${order.number}`;

      // Check for existing
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("order_id", orderId)
        .limit(1);

      let isExisting = false;
      if (existing && existing.length > 0) {
        isExisting = true;
      }

      // Fetch line items from v4 API
      let lineItems = [];
      try {
        lineItems = await fetchOrderLines(order.id, booqableApiKey);
      } catch (e) {
        console.error(`Failed to fetch lines for order ${orderId}:`, e.message);
      }

      // Extract data
      const customer = order.customer || {};
      const props = order.properties_attributes || {};
      const accessPoint =
        props.selected_access_point ||
        props.beach_location ||
        props.access_point ||
        "";
      const specialInstructions =
        props.special_instructions ||
        props.additional_info ||
        props.address ||
        "";

      const customerPhone = customer.phone ||
        (customer.properties_attributes && customer.properties_attributes.phone) || "";

      const formattedItems = lineItems
        .filter((line) => {
          const name = (line.title || line.name || "").toLowerCase();
          return !name.includes("bundle");
        })
        .map((line) => ({
          name: line.title || line.name || "Unknown",
          quantity: line.quantity || 1,
        }));

      const totalCents = order.grand_total_with_tax_in_cents || order.amount_in_cents || 0;

      const row = {
        order_id: orderId,
        delivery_date: today,
        end_date: order.stops_at ? order.stops_at.substring(0, 10) : null,
        customer_name: customer.name || null,
        email: customer.email || null,
        phone: customerPhone || null,
        address: specialInstructions || null,
        access_point: accessPoint || null,
        items: formattedItems.length > 0 ? formattedItems : null,
        total: totalCents / 100,
        logo_url: "/assets/logo.webp",
        printed: false,
      };

      if (isExisting) {
        console.log("Sync updating:", orderId, row.customer_name);
        // Do not overwrite print tracking metadata for existing orders
        delete row.printed;
        
        const { error: updateErr } = await supabase.from("orders").update(row).eq("order_id", orderId);
        if (updateErr) {
          console.error(`Update error for ${orderId}:`, updateErr.message);
          errors++;
        } else {
          synced++;
        }
      } else {
        console.log("Sync inserting:", orderId, row.customer_name);
        const { error: insertErr } = await supabase.from("orders").insert([row]);
        if (insertErr) {
          console.error(`Insert error for ${orderId}:`, insertErr.message);
          errors++;
        } else {
          synced++;
        }
      }
    }

    console.log(`Sync complete: synced=${synced}, skipped=${skipped}, errors=${errors}`);
    return res.status(200).json({ synced, skipped, errors, total: todayOrders.length });
  } catch (err) {
    console.error("sync-booqable-orders error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ──────────────────────────────────────────────
// Fetch all reserved orders from Booqable v1 API
// that start on the given date (YYYY-MM-DD)
// ──────────────────────────────────────────────
async function fetchTodaysOrders(apiKey, targetDate) {
  const allTodayOrders = [];
  let page = 1;
  const perPage = 50;
  let totalPages = 1;

  // We need to paginate through ALL reserved orders
  // and filter by starts_at date
  while (page <= totalPages) {
    const url =
      `https://${BOOQABLE_SLUG}.booqable.com/api/1/orders` +
      `?api_key=${apiKey}&status=reserved&per=${perPage}&page=${page}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error(`Booqable API error on page ${page}:`, res.status);
      break;
    }

    const data = await res.json();
    const orders = data.orders || [];
    const totalCount = data.meta?.total_count || 0;
    totalPages = Math.ceil(totalCount / perPage);

    for (const order of orders) {
      // Check if this order starts today
      const startsAt = order.starts_at || "";
      const orderDate = startsAt.substring(0, 10);

      // Convert UTC start time to Eastern date
      // Booqable stores starts_at in UTC (e.g., "2026-04-02T09:00:00.000Z")
      // 09:00 UTC = 5:00 AM ET, so the date should still be the same
      if (orderDate === targetDate) {
        allTodayOrders.push(order);
      }

      // Optimization: if we've gone past today's date, we can stop
      // Orders are roughly chronological, so if order dates are
      // far past today we don't need to keep going.
      // But orders may not be perfectly sorted, so we check all pages.
    }

    page++;

    // Safety limit — don't paginate forever
    if (page > 100) {
      console.warn("Hit 100-page safety limit");
      break;
    }
  }

  return allTodayOrders;
}

// ──────────────────────────────────────────────
// Fetch line items for a specific order using v4 API
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
    .filter((inc) => inc.type === "lines")
    .map((inc) => inc.attributes);
}
