const fs = require('fs');
let html = fs.readFileSync('/Users/dncnguyen/Antigravity/DNC Operator/index.html', 'utf8');

// Replace ?p= with #
html = html.replace(/history\.replaceState\(null, '', '\?p=' \+ prod\.id\);/g, "history.replaceState(null, '', '#' + prod.id);");

fs.writeFileSync('/Users/dncnguyen/Antigravity/DNC Operator/index.html', html);
console.log("Patched!");
