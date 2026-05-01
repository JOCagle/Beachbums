const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;
  content = content.replace(/href=\"index\.html\"/g, 'href=\"/\"');
  content = content.replace(/href=\"(pricing|about|blog|contact|privacy|order-stay)\.html\"/g, 'href=\"$1\"');
  if (content !== original) {
    fs.writeFileSync(f, content);
    console.log('Stripped .html links from', f);
  }
});
