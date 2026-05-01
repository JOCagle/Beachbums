const { createClient } = require("@supabase/supabase-js");

// ──────────────────────────────────────────────
// Booqable Webhook Receiver
// Booqable POSTs here when an order is created/reserved.
// We parse the payload and upsert into Supabase.
// ──────────────────────────────────────────────

const BOOQABLE_SLUG = "beach-bums-chair-umbrella-rental";

// Read the raw body from the request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const booqableApiKey = process.env.BOOQABLE_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY");
    return res.status(500).json({ ok: false, error: "Server misconfigured" });
  }

  try {
    const rawBody = await getRawBody(req);
    console.log("booqable-webhook raw (first 500):", rawBody.substring(0, 500));

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("Invalid JSON from Booqable:", rawBody.substring(0, 300));
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    // ──────────────────────────────────────────
    // Handle multiple payload formats:
    // 1. Zapier: { id: "booqable-order-uuid" }
    // 2. Booqable JSON:API v4: { data: { id, type, attributes } }
    // 3. Booqable v1: { order: { ... } }
    // ──────────────────────────────────────────
    let incomingId;
    let order = {};

    if (payload.data && payload.data.attributes) {
      // JSON:API v4 format
      incomingId = payload.data.id;
      order = { id: payload.data.id, ...payload.data.attributes };
    } else if (payload.order) {
      // v1 format
      incomingId = payload.order.id;
      order = payload.order;
    } else if (payload.id) {
      // Zapier format — just the Booqable order ID
      incomingId = payload.id;
      order = { id: payload.id };
    } else {
      // Unknown format — try to use as-is
      incomingId = payload.id;
      order = payload;
    }

    // Zapier sometimes sends the ID multiple times comma-separated — take the first
    if (incomingId && incomingId.includes(",")) {
      incomingId = incomingId.split(",")[0].trim();
    }

    console.log("Webhook received. Incoming ID:", incomingId);

    // ──────────────────────────────────────────
    // ALWAYS fetch full order from Booqable API
    // The incoming payload (especially from Zapier) may only have an ID.
    // We need customer, dates, items, properties, etc.
    // ──────────────────────────────────────────
    const fullOrder = await fetchFullOrder(incomingId, booqableApiKey);
    if (!fullOrder) {
      console.error("Could not fetch full order from Booqable API for ID:", incomingId);
      if (!order.number && !order.status) {
        return res.status(500).json({ ok: false, error: "Could not fetch order from Booqable" });
      }
      // Fall back to whatever we have in the webhook payload
    }

    const source = fullOrder || order;

    // Check status AFTER fetching — skip non-reserved orders
    const status = String(source.status || "").toLowerCase();
    console.log("Order number:", source.number, "status:", status);
    if (status && !["reserved", "new", "concept"].includes(status)) {
      console.log("Skipping order with status:", status);
      return res.status(200).json({ ok: true, skipped: true, reason: `status=${status}` });
    }

    // Extract customer info
    const customer = source.customer || {};
    const customerName = customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "";
    const customerEmail = customer.email || "";
    const customerPhone = extractPhone(customer);

    // Extract dates
    const startsAt = source.starts_at || source.starts || "";
    const stopsAt = source.stops_at || source.stops || "";
    const deliveryDate = startsAt ? startsAt.substring(0, 10) : null;
    const endDate = stopsAt ? stopsAt.substring(0, 10) : null;

    // Extract properties (access point, special instructions)
    const props = source.properties_attributes || source.properties || {};
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

    // Extract line items (from the full fetch)
    const items = source._lines || [];
    const formattedItems = items
      .filter((line) => {
        const name = (line.title || line.name || "").toLowerCase();
        // Ignore "bundle" items to prevent double counting.
        // Booqable includes both the abstract bundle package AND its physical components.
        // We only want to print the individual physical items.
        return !name.includes("bundle");
      })
      .map((line) => ({
        name: line.title || line.name || "Unknown",
        quantity: line.quantity || 1,
      }));

    // Extract total
    const totalCents = source.grand_total_with_tax_in_cents || source.amount_in_cents || 0;
    const total = totalCents / 100;

    // Build the order_id using Booqable's order number
    const orderNumber = String(source.number || "");
    if (!orderNumber) {
      console.warn("Webhook aborted: Missing order.number. Throwing 500 so Zapier retries.");
      return res.status(500).json({ ok: false, error: "Missing order number from Booqable API" });
    }
    const orderId = `BQ-${orderNumber}`;

    // Build the row
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
      total: total || 0,
      logo_url: "/assets/logo.webp",
      printed: false,
    };

    console.log("Webhook row:", JSON.stringify(row));

    // Upsert into Supabase (skip if duplicate)
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (row.order_id) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("order_id", row.order_id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log("Webhook: order exists, updating:", row.order_id);
        delete row.printed; // Prevent webhook updates from resetting print status
        
        const { data, error } = await supabase
          .from("orders")
          .update(row)
          .eq("order_id", row.order_id)
          .select();

        if (error) {
          console.error("Supabase update error:", error);
          return res.status(500).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true, id: existing[0].id, updated: true });
      }
    }

    const { data, error } = await supabase.from("orders").insert([row]).select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    console.log("Webhook: order saved:", data?.[0]?.id);
    return res.status(200).json({ ok: true, id: data?.[0]?.id, source: "webhook" });
  } catch (err) {
    console.error("booqable-webhook error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ──────────────────────────────────────────────
// Fetch full order details from Booqable v4 API
// including customer and line items
// ──────────────────────────────────────────────
async function fetchFullOrder(booqableOrderId, apiKey) {
  console.log("fetchFullOrder called with ID:", booqableOrderId, "hasApiKey:", !!apiKey);
  if (!apiKey || !booqableOrderId) {
    console.error("Missing apiKey or orderId", { hasKey: !!apiKey, hasId: !!booqableOrderId });
    return null;
  }

  try {
    // ──────────────────────────────────────────
    // Step 1: Hit V1 API first to resolve the UUID.
    // The incoming ID from Zapier might be an order number (e.g., "1493").
    // V1 allows lookup by order number and returns the true UUID.
    // ──────────────────────────────────────────
    const v1Url =
      `https://${BOOQABLE_SLUG}.booqable.com/api/1/orders/${booqableOrderId}` +
      `?api_key=${apiKey}`;
    
    console.log("Fetching v1 order to resolve UUID and customer details...");
    const v1Res = await fetch(v1Url, { headers: { Accept: "application/json" } });
    
    if (!v1Res.ok) {
      console.error("Booqable v1 order fetch failed:", v1Res.status);
      return null;
    }

    const v1Data = await v1Res.json();
    const v1Order = v1Data.order || {};
    const uuid = v1Order.id; // This is the true UUID needed for V4
    
    if (!uuid) {
      console.error("V1 API did not return a valid order ID");
      return null;
    }

    const customer = v1Order.customer || {};
    const properties = v1Order.properties_attributes || {};

    console.log(`V1 successful. Resolved UUID: ${uuid}, Customer: ${customer.name || "None"}`);

    // ──────────────────────────────────────────
    // Step 2: Hit V4 API using the true UUID.
    // This is required to get the line items (_lines) mapping.
    // ──────────────────────────────────────────
    const orderUrl =
      `https://${BOOQABLE_SLUG}.booqable.com/api/4/orders/${uuid}` +
      `?include=lines` +
      `&fields[orders]=number,status,starts_at,stops_at,grand_total_with_tax_in_cents` +
      `&fields[lines]=title,quantity,price_in_cents`;

    console.log("Fetching V4 order to get line items...");
    const v4Res = await fetch(orderUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    let attrs = {};
    let lines = [];

    if (!v4Res.ok) {
       console.warn(`Booqable v4 order fetch failed (${v4Res.status}) for UUID ${uuid}. Proceeding with V1 data only.`);
    } else {
       const orderData = await v4Res.json();
       attrs = orderData.data?.attributes || {};
       lines = (orderData.included || [])
         .filter((inc) => inc.type === "lines")
         .map((inc) => inc.attributes);
       console.log(`V4 successful. Retrieved ${lines.length} line items.`);
    }

    // Merge and return
    return {
      id: uuid,
      number: attrs.number || v1Order.number,
      status: attrs.status || v1Order.status,
      starts_at: attrs.starts_at || v1Order.starts_at,
      stops_at: attrs.stops_at || v1Order.stops_at,
      grand_total_with_tax_in_cents:
        attrs.grand_total_with_tax_in_cents || v1Order.grand_total_with_tax_in_cents,
      amount_in_cents: v1Order.amount_in_cents,
      customer,
      properties_attributes: properties,
      notes: v1Order.notes || [],
      _lines: lines,
    };
  } catch (e) {
    console.error("fetchFullOrder error:", e.message);
    return null;
  }
}

// Fallback: fetch from v1 API only (no line items but has customer/properties)
async function fetchFullOrderV1(booqableOrderId, apiKey) {
  try {
    const url =
      `https://${BOOQABLE_SLUG}.booqable.com/api/1/orders/${booqableOrderId}` +
      `?api_key=${apiKey}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const order = data.order || {};
    return {
      ...order,
      _lines: [],
    };
  } catch (e) {
    console.error("fetchFullOrderV1 error:", e.message);
    return null;
  }
}

// Extract phone from customer (could be in properties or direct field)
function extractPhone(customer) {
  if (!customer) return "";
  if (customer.phone) return customer.phone;
  const props = customer.properties_attributes || customer.properties || {};
  return props.phone || props.phone_number || "";
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
