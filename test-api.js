const fs = require('fs');

async function main() {
  const output = [];
  const log = (...args) => output.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' '));

  log('=== Test POST to webhook with order number ===');
  try {
    const res = await fetch("https://www.beachbumsiop.com/api/booqable-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1493" })
    });
    
    log('Status:', res.status);
    const data = await res.json();
    log(data);
  } catch(e) {
    log('Error:', e.message);
  }

  // Also read a few lines of the CSV just to extract numbers
  try {
    const content = fs.readFileSync('c:\\Users\\skobi\\Downloads\\orders-export-2026-03-31.csv', 'utf8');
    const lines = content.split('\n');
    log('\n=== CSV Order Numbers ===');
    const numbers = [];
    for (let i = 1; i < lines.length && i < 6; i++) {
       const cols = lines[i].split(',');
       if (cols[0]) numbers.push(cols[0]);
    }
    log(numbers);
  } catch(e) {
     log('Error reading CSV:', e.message);
  }

  fs.writeFileSync('test-out.txt', output.join('\n'), 'utf8');
  console.log('Done');
}

main().catch(console.error);
