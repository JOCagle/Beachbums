const fs = require('fs');

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
htmlFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;
  content = content.replace(/href="index\.html"/g, 'href="index.html"');
  content = content.replace(/href="(pricing|about|blog|contact|privacy|order-stay|order-gear|order-address|order-dates|order-condo|order-review|order-confirm|order-contact)\.html"/g, 'href="$1"');
  if (content !== original) {
    fs.writeFileSync(f, content);
    console.log('Stripped .html from', f);
  }
});

const jsFiles = ['js/order-stay.js', 'js/order-gear.js', 'js/order-review.js', 'js/order-address.js', 'js/order-condo.js', 'js/order-dates.js', 'js/order-contact.js'];
jsFiles.forEach(f => {
  if(fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    content = content.replace(/location\.href\s*=\s*["']([^"']+)\.html["']/g, 'location.href = "$1"');
    if (content !== original) {
      fs.writeFileSync(f, content);
      console.log('Stripped .html from', f);
    }
  }
});
