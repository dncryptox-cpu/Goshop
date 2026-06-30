const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('file:///Users/dncnguyen/Antigravity/DNC Operator/customer/index.html');
    
    // Switch to new_order tab
    await page.evaluate(() => {
        document.querySelector('[x-data="customerPortal()"]').__x.$data.activeTab = 'new_order';
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    // Click on the CAPCUT product
    await page.click('div[x-show="activeTab === \'new_order\'"] .grid > div');
    
    await new Promise(r => setTimeout(r, 500));
    
    const hash = await page.evaluate(() => window.location.hash);
    console.log("Current Hash after click:", hash);
    
    await browser.close();
})();
