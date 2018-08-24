const express = require('express');
const app = express();
const puppeteer = require('puppeteer');

const port = 3000;
let browser = null;

const sanitizePage = () => {
    const elements = document.querySelectorAll('script, link[rel=import]');
    for (const e of Array.from(elements)) {
        e.remove();
    }
}

app.get('*', async (req, res) => {
    try {
        const page = await browser.newPage();
        await page.setUserAgent('bot-exlpre-0.0.1');
        
        await page.goto(req.originalUrl.substring(1), {
            waitUntil: "networkidle0",
        });
        
        await page.evaluate(sanitizePage)

        const html = await page.evaluate(() => {
            return document.documentElement.innerHTML;
        });

        res.send(html);
    } catch(e) {
        console.log(e);
        res.status(500).send("ERROR");
    }
});

app.listen(port, async () => {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-dev-shm-usage']
    });
    console.log(`Web server is running at port ${port}`);
});
