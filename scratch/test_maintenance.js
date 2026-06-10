async function check() {
    const url = 'https://docs.google.com/spreadsheets/d/1sdL8wF3pLDZ6V_mUqG2aVmI5f60foDzD0ZA0CmC6m3c/gviz/tq?tqx=out:json&sheet=SYSTEM_CONFIG&t=' + Date.now();
    try {
        const response = await fetch(url);
        const text = await response.text();
        console.log("Raw Response length:", text.length);
        if (text.includes('INVALID_SHEET')) {
            console.log("SHEET DOES NOT EXIST!");
            return;
        }
        const jsonStr = text.substring(text.indexOf('({') + 1, text.lastIndexOf('})') + 1);
        const data = JSON.parse(jsonStr);
        let maintenance = "NOT FOUND";
        if (data.table && data.table.rows) {
            data.table.rows.forEach(row => {
                if (row.c && row.c[0] && row.c[1]) {
                    if (row.c[0].v === "MAINTENANCE_MODE") {
                        maintenance = row.c[1].v;
                    }
                }
            });
        }
        console.log("MAINTENANCE_MODE IS:", maintenance);
    } catch(e) {
        console.log("Error:", e.message);
    }
}
check();
