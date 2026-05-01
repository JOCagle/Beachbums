const PDFDocument = require("pdfkit");

// ──────────────────────────────────────────────
// Vercel Serverless Function to test PrintNode connection
// ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const printNodeApiKey = process.env.PRINTNODE_API_KEY;
  const printNodePrinterId = process.env.PRINTNODE_PRINTER_ID;

  if (!printNodeApiKey || !printNodePrinterId) {
    return res.status(500).json({ 
      error: "Missing PrintNode credentials (PRINTNODE_API_KEY or PRINTNODE_PRINTER_ID)",
      status: "Configuration Required"
    });
  }

  try {
    const pdfBuffer = await buildTestPdf();
    
    const response = await sendPdfToPrintNode({
      apiKey: printNodeApiKey,
      printerId: Number(printNodePrinterId),
      title: `Beach Bums Test Print — ${new Date().toISOString()}`,
      pdfBuffer,
    });

    return res.status(200).json({
      message: "Test print job successfully sent to PrintNode!",
      printNodeJobId: response,
      note: "Check your physical printer. If it didn't print, verify that the PrintNode Client is running on your computer, the printer is turned on, and PRINTNODE_PRINTER_ID matches your target printer."
    });

  } catch (err) {
    console.error("Test print failed:", err);
    return res.status(500).json({ 
      error: "Failed to send job to PrintNode", 
      details: err.message || err 
    });
  }
};

async function buildTestPdf() {
  return new Promise((resolve, reject) => {
    // Standard phone/ticket size
    const doc = new PDFDocument({ margin: 20, size: [240, 400] });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a1a1a').text('TEST PRINT', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica').fillColor('#1a8fd1').text('Beach Bums Print System', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#1a1a1a').text(`Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`, { align: 'center' });
    doc.moveDown(2);
    doc.text('If you are reading this, your PrintNode integration is successfully configured and working!', { align: 'center' });
    
    doc.end();
  });
}

async function sendPdfToPrintNode({ apiKey, printerId, title, pdfBuffer }) {
  const body = JSON.stringify({
    printerId,
    title,
    contentType: "pdf_base64",
    content: pdfBuffer.toString("base64"),
    source: "Beach Bums Test",
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
