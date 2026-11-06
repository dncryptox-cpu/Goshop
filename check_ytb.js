const url = `https://docs.google.com/spreadsheets/d/1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc/gviz/tq?tqx=out:json&sheet=DATA(YTB)`;
fetch(url).then(res => res.text()).then(text => {
    const json = JSON.parse(text.substring(47).slice(0, -2));
    console.log(json.table.cols.map(c => c.label));
    console.log(json.table.rows[0].c.map(cell => cell ? cell.v : null));
}).catch(console.error);
