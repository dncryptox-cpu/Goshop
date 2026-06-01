const fetch = require('node-fetch');
const ID = '1d_kaFjbE3Sd8fkfya61Yi2AQx6KUyMgghLrSwayAN9k';
const tabs = ['CUSTOMERS', 'PRODUCTS', 'STAFF', 'ACTIVE_SUBSCRIPTIONS'];

async function test() {
    for (const tab of tabs) {
        const url = `https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
        const res = await fetch(url);
        const text = await res.text();
        console.log(`--- ${tab} ---`);
        console.log(text.substring(0, 150));
    }
}
test();
