const fs = require('fs');

async function importCsvToSupabase() {
  const output = [];
  const log = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
    console.log(msg);
    output.push(msg);
  };

  const CSV_FILE_PATH = 'c:\\Users\\skobi\\Downloads\\orders-export-2026-03-31.csv';
  const WEBHOOK_URL = 'https://www.beachbumsiop.com/api/booqable-webhook';

  log('=== Starting CSV Import to Supabase via Webhook ===');
  log(`Reading CSV from: ${CSV_FILE_PATH}`);

  let content;
  try {
    content = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  } catch (err) {
    log('❌ Error reading CSV file:', err.message);
    return;
  }

  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length <= 1) {
    log('CSV appears to be empty or only contains headers.');
    return;
  }

  // Skip the header row (index 0)
  log(`Found ${lines.length - 1} records to process.`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(',');
    const orderNumber = columns[0]; // Assuming order number is the first column

    if (!orderNumber || isNaN(orderNumber)) {
       log(`[Row ${i}] Invalid order number: ${orderNumber}, skipping.`);
       continue;
    }

    log(`[Row ${i}/${lines.length - 1}] Processing Order #${orderNumber}...`);
    
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderNumber })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.duplicate) {
          log(`  -> ⏭️  Skipped (already exists in Supabase DB)`);
          skipCount++;
        } else if (data.skipped) {
          log(`  -> ⏭️  Skipped (${data.reason})`);
          skipCount++;
        } else {
          log(`  -> ✅ Inserted successfully! Supabase ID: ${data.id}`);
          successCount++;
        }
      } else {
        log(`  -> ❌ Failed to insert! Status: ${res.status}, Error:`, data);
        errorCount++;
      }
    } catch (e) {
      log(`  -> ❌ Network/Execution Error:`, e.message);
      errorCount++;
    }
    
    // Slight delay to be nice to the APIs
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  log('\n=== Import Completed ===');
  log(`✅ Successfully Inserted: ${successCount}`);
  log(`⏭️  Skipped (Duplicates/Status): ${skipCount}`);
  log(`❌ Errors: ${errorCount}`);

  fs.writeFileSync('import-results.txt', output.join('\n'), 'utf8');
}

importCsvToSupabase().catch(console.error);
