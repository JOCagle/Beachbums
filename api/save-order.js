const { createClient } = require("@supabase/supabase-js");

// Manually read the raw body from the request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handler(req, res) {
  // Set CORS headers for cross-origin requests from Booqable
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only accept POST for the actual logic
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY env vars");
    return res.status(500).json({ ok: false, error: "Server misconfigured" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read the raw body ourselves (since we disabled Vercel's auto-parser)
    const rawBody = await getRawBody(req);
    console.log("RAW BODY (first 500 chars):", rawBody.substring(0, 500));

    let order = {};
    try {
      order = JSON.parse(rawBody);
    } catch (e) {
      console.error("JSON parse failed, raw body was:", rawBody.substring(0, 300));
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    console.log("PARSED order keys:", Object.keys(order));
    console.log("order.dates:", JSON.stringify(order.dates));
    console.log("order.customer:", JSON.stringify(order.customer));
    console.log("order.address:", order.address);

    // Build the row for the orders table
    const row = {
      order_id: order.orderId || null,
      delivery_date: order.dates?.start || null,
      end_date: order.dates?.end || null,
      customer_name: [order.customer?.firstName, order.customer?.lastName]
        .filter(Boolean)
        .join(" ") || null,
      email: order.customer?.email || null,
      phone: order.customer?.phone || null,
      address: order.address || null,
      access_point:
        typeof order.chosenAccess === "string"
          ? order.chosenAccess
          : order.chosenAccess?.name || null,
      items: order.items || {
        chairs: Number(order.qty?.chairs || 0),
        umbrellas: Number(order.qty?.umbrellas || 0),
        coolers: Number(order.qty?.coolers || 0),
      },
      total: Number(order.totals?.total || 0),
      logo_url: order.logoUrl || "/assets/logo.webp",
      printed: false,
    };

    console.log("FINAL ROW:", JSON.stringify(row));

    // Check for duplicate order_id before inserting
    if (row.order_id) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("order_id", row.order_id)
        .limit(1);
      if (existing && existing.length > 0) {
        console.log("Duplicate order_id, skipping:", row.order_id);
        return res.status(200).json({ ok: true, id: existing[0].id, duplicate: true });
      }
    }

    const { data, error } = await supabase.from("orders").insert([row]).select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    console.log("Order saved:", data?.[0]?.id);
    return res.status(200).json({ ok: true, id: data?.[0]?.id });
  } catch (err) {
    console.error("save-order error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// IMPORTANT: Set handler first, THEN attach config as a property.
// If you do it the other way around, module.exports = handler wipes out .config!
module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
