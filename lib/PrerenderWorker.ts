import * as puppeteer from "puppeteer";
import {CrawlPage} from "./CrawlPage";
import {crawlerSanitizePage, crawlerScrapeAllLinks} from "./Helpers";

export class PrerenderWorker {
    private browser = null;
    private readonly crawlRegex: RegExp;

    constructor(crawlRegex: RegExp) {
        this.crawlRegex = crawlRegex;
    }

    async setup() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--disable-dev-shm-usage']
        });
    }

    private getWhitelistedUrls(all: string[]) {
        if (!all || all.length < 1) {
            return [] as string[];
        }
        return all.filter(url => url.match(this.crawlRegex));
    }

    async render(cp: CrawlPage) {
        console.debug("Rendering URL: ", cp.url);
        if (!this.browser) {
            return Promise.reject("Worker not setup");
        }

        const page = await this.browser.newPage();
        await page.setUserAgent('bot-exlpre-0.0.1');

        await page.goto(cp.url, {
            waitUntil: "networkidle0",
        });

        await page.evaluate(crawlerSanitizePage);

        cp.resultHTML = await page.evaluate(() => {
            return document.documentElement.innerHTML;
        });

        cp.linksTo = this.getWhitelistedUrls(await page.evaluate(crawlerScrapeAllLinks));

        // Clean up the tab
        await page.goto('about:blank');
        await page.close();

        console.debug("Completed rendering URL: ", cp.url);
    }
}
