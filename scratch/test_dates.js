function test() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const tasks = [
        {"Trạng thái": "FULL", "Ngày renew": "12/06/2026"},
        {"Trạng thái": "Còn slot", "Ngày renew": "8/6/2026"},
        {"Trạng thái": "NK Plus", "Ngày renew": "5/7/2026"},
        {"Trạng thái": "NK Plus", "Ngày renew": ""}
    ];

    tasks.forEach(t => {
        if (!t['Ngày renew']) return;
        const parts = t['Ngày renew'].split('/');
        const day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        
        let effectiveDate;
        let type = t['Trạng thái'] || '';
        
        if (type.includes('Plus')) {
            // "Plus" uses the current month and year
            effectiveDate = new Date(currentYear, currentMonth, day);
        } else {
            effectiveDate = new Date(year, month, day);
        }
        
        const diffTime = effectiveDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        console.log(t['Trạng thái'], t['Ngày renew'], '-> effective:', effectiveDate.toLocaleDateString(), 'diff:', diffDays);
    });
}
test();
