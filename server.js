const express = require('express');
const app = express();
const puppeteer = require('puppeteer');

const port = 3000;
app.get('*', async (req, res) => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('bot-exlpre-0.0.1');

        await page.goto(req.originalUrl.substring(1), {
            waitUntil: "networkidle0",
        });

        const html = await page.evaluate(() => {
            return document.documentElement.innerHTML;
        });

        res.send(html);

    } catch(e) {
        console.log(e);
        res.send("ERROR");
    }
});

app.listen(port, () => {
    console.log(`Web server is running at port ${port}`);
});
