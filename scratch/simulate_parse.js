const csvText = `"Slot","STT FAM","Trạng thái","StockRenew","Pass","MKP","2fa","Ngày Renew","Fam thay thế"
"5","1","FULL","a07711589062@gmail.com","08/10/33629","a07711589062646@outlook.com","abr3 pvge...","16/7/2026",""
"5","2","FULL","t01093309788@gmail.com","93309788","t01093309788990@outlook.com","uanq u7i3...","23/7/2026",""
"4","21","Còn slot","t01094393171@gmail.com","94393171","t01094393171664@outlook.com","bn5r 6szk...","28/07/2026",""
`;

function parseCSV(csv) {
    if (!csv || csv.includes('html')) return [];
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if(lines.length < 2) return [];
    
    const parsedLines = lines.map(line => {
        return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
    });

    let maxCols = 0;
    parsedLines.forEach(vals => {
        if (vals.length > maxCols) maxCols = vals.length;
    });
    
    const headerVals = parsedLines[0];
    const headers = [];
    for(let i = 0; i < maxCols; i++) {
        let h = headerVals[i] || '';
        h = h === '' ? `Col_${i}` : h;
        if (headers.includes(h)) {
            h = `${h}_${i}`;
        }
        headers.push(h);
    }
    
    return parsedLines.slice(1).map(values => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i] || '';
        });
        return obj;
    }).filter(row => Object.values(row).some(v => v !== '' && !v.startsWith('Col_')));
}

const frData = parseCSV(csvText);
console.log("frData length:", frData.length);
console.log("First item:", frData[0]);

const row = frData[0];
const keys = Object.keys(row);
console.log("keys:", keys);

const kSlot     = keys.find(k => k.toLowerCase() === 'slot' || k.toLowerCase().includes('slot')) || keys[0];
const kStt      = keys.find(k => k.toLowerCase().includes('stt') || k.toLowerCase().includes('fam')) || keys[1];
const kStatus   = keys.find(k => k.toLowerCase().includes('trạng thái') || k.toLowerCase().includes('status')) || keys[2];

console.log("kSlot matched key:", kSlot, "value:", row[kSlot]);
console.log("kStt matched key:", kStt, "value:", row[kStt]);
console.log("kStatus matched key:", kStatus, "value:", row[kStatus]);
