const sgMail = require("@sendgrid/mail");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const toEmail = process.env.ORDER_TO_EMAIL || "connor@beachbumsiop.com";
  const fromEmail = process.env.ORDER_FROM_EMAIL || "no-reply@beachbumsiop.com";

  if (!apiKey) {
    return res.status(500).send("Missing SENDGRID_API_KEY env var");
  }

  try {
    sgMail.setApiKey(apiKey);

    const order = req.body || {};
    const name = `${order?.contact?.first || ""} ${order?.contact?.last || ""}`.trim();
    const subject = `New Beach Bums order — ${name || "Customer"}`;

    const text = [
      `Name: ${name}`,
      `Email: ${order?.contact?.email || ""}`,
      `Phone: ${order?.contact?.phone || ""}`,
      "",
      `Dates: ${order?.dates?.start || ""} to ${order?.dates?.end || ""}`,
      `Address: ${order?.address || ""}`,
      `Selected access: ${order?.chosenAccess || ""}`,
      "",
      `Chairs: ${order?.items?.chairs || 0}`,
      `Umbrellas: ${order?.items?.umbrellas || 0} (table included)`,
      `Coolers: ${order?.items?.coolers || 0}`,
      `Bundles (2 chairs + 1 umbrella): ${order?.items?.bundles || 0}`,
      "",
      `Total days: ${order?.totals?.days || ""}`,
      `Total price: ${order?.totals?.total || ""}`,
    ].join("\n");

    await sgMail.send({
      to: toEmail,
      from: fromEmail,
      subject,
      text,
      html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${text.replace(/</g, "&lt;")}</pre>`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
