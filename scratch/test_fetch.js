
const SHEET_ID = '1sdL8wF3pLDZ6V_mUqG2aVmI5f60foDzD0ZA0CmC6m3c';
const TAB_NAME = 'APP_DATA';
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB_NAME)}`;

fetch(url)
    .then(res => res.text())
    .then(data => {
        console.log("Data sample:");
        console.log(data.split('\n').slice(0, 5).join('\n'));
    })
    .catch(err => console.error(err));
