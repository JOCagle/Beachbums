const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.startsWith('order-') && f.endsWith('.html'));

const target = '<link rel="stylesheet" href="css/style.css" />';
const replacement = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css" />`;

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('fonts.googleapis.com')) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
}
