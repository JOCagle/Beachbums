// ──────────────────────────────────────────────
// One-time script: Register Booqable Webhook
// Run with: node scripts/register-booqable-webhook.js
//
// This registers a webhook endpoint with Booqable
// so they POST to your Vercel function whenever
// an order is created or reserved.
// ──────────────────────────────────────────────

const BOOQABLE_SLUG = "beach-bums-chair-umbrella-rental";
const BOOQABLE_API_KEY = process.env.BOOQABLE_API_KEY || "0978cc2338e7e846b7bc39169c66c225e16893cb03860781a13555f15fc5cd68";
const WEBHOOK_URL = "https://www.beachbumsiop.com/api/booqable-webhook";

async function main() {
  console.log("Registering Booqable webhook...");
  console.log("  Slug:", BOOQABLE_SLUG);
  console.log("  Webhook URL:", WEBHOOK_URL);
  console.log("  Events: order.created, order.reserved\n");

  const url = `https://${BOOQABLE_SLUG}.booqable.com/api/4/webhook_endpoints`;

  const body = {
    data: {
      type: "webhook_endpoints",
      attributes: {
        url: WEBHOOK_URL,
        enabled: true,
        event_types: ["order.created", "order.reserved"],
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${BOOQABLE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.ok) {
    console.log("✅ Webhook registered successfully!");
    console.log("   ID:", data.data?.id);
    console.log("   URL:", data.data?.attributes?.url);
    console.log("   Events:", data.data?.attributes?.event_types);
    console.log("   Enabled:", data.data?.attributes?.enabled);
  } else {
    console.error("❌ Failed to register webhook");
    console.error("   Status:", res.status);
    console.error("   Response:", JSON.stringify(data, null, 2));
  }

  // Also list existing webhooks
  console.log("\n--- Existing webhook endpoints ---");
  const listRes = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${BOOQABLE_API_KEY}`,
    },
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    const endpoints = listData.data || [];
    if (endpoints.length === 0) {
      console.log("  (none)");
    } else {
      endpoints.forEach((ep) => {
        console.log(`  [${ep.id}] ${ep.attributes?.url}`);
        console.log(`    Events: ${ep.attributes?.event_types?.join(", ")}`);
        console.log(`    Enabled: ${ep.attributes?.enabled}`);
      });
    }
  }
}

main().catch(console.error);
