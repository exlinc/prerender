import * as express from 'express';
import {crawlerSanitizePage} from "./Helpers";
import * as puppeteer from "puppeteer";

export class PrerenderLiveServer {
    private app = express();
    private browser = null;
    private readonly port: number;

    constructor(port: number) {
        this.port = port;
        this.app.get('*', this.handler);
    }

    handler = async (req, res) => {
        try {
            const page = await this.browser.newPage();
            await page.setUserAgent('bot-exlpre-0.0.1');

            await page.goto(req.originalUrl.substring(1), {
                waitUntil: "networkidle0",
            });

            await page.evaluate(crawlerSanitizePage);

            const html = await page.evaluate(() => {
                return document.documentElement.innerHTML;
            });

            res.send(html);

            // Clean up the tab
            await page.goto('about:blank')
            await page.close();
        } catch(e) {
            console.error("Live prerender server error: ", e);
            res.status(500).send("Internal server error");
        }
    }

    async serve() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--disable-dev-shm-usage']
        });
        this.app.listen(this.port, () => {
            console.log(`Live prerender server is running on port ${this.port}`);
        });
    }
}
