const fs = require('fs');
let html = fs.readFileSync('/Users/dncnguyen/Antigravity/DNC Operator/customer/index.html', 'utf8');

// Replace hash with pushState
html = html.replace(/window\.location\.hash = prod\.id;/g, "history.replaceState(null, '', '?p=' + prod.id);");

fs.writeFileSync('/Users/dncnguyen/Antigravity/DNC Operator/customer/index.html', html);
console.log("Patched!");
