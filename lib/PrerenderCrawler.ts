import {promisify} from "util";
import {PrerenderWorker} from "./PrerenderWorker";
import {CrawlPage} from "./CrawlPage";
import {mkDirAllSync} from "./Helpers";
import * as path from 'path';
import * as fs from 'fs';

export class PrerenderCrawler {
    private initialized = false;
    private readonly maxRetries: number;
    private readonly index: string;
    private readonly crawlRegex: RegExp;
    private readonly outputDir: string;
    private readonly workers: PrerenderWorker[];
    private completedPages: { [url: string]: boolean; } = {};
    private queuedUrls: { [url: string]: boolean} = {};
    private pendingUrls: { [url: string]: boolean} = {};
    private retriedUrls: { [url: string]: number} = {};
    private failedUrls: { [url: string]: string} = {};

    constructor(index: string, crawlRegex: RegExp, outputDir: string, workerCount: number, maxRetries = 3) {
        this.index = index;
        this.crawlRegex = crawlRegex;
        this.outputDir = outputDir;
        this.workers = new Array(workerCount);
        this.maxRetries = maxRetries;
    }

    async setup() {
        for (let i = 0; i < this.workers.length; i++) {
            this.workers[i] = new PrerenderWorker(this.crawlRegex);
            await this.workers[i].setup();
        }
        this.initialized = true;
    }

    queuePages(urls: string[]) {
        if (!urls || urls.length == 0) {
            return
        }
        urls.forEach(url => this.queuePage(url))
    }

    queuePage(url: string) {
        if (this.completedPages[url] || this.queuedUrls[url] || this.pendingUrls[url] || this.failedUrls[url]) {
            return
        }
        this.queuedUrls[url] = true;
    }

    forceQueuePage(url: string) {
        this.queuedUrls[url] = true;
    }

    arePagesPending() {
        return Object.keys(this.pendingUrls).length > 0;
    }

    queueHasItems() {
        return Object.keys(this.queuedUrls).length > 0;
    }

    pullQueuedPage() {
        if (!this.queueHasItems()) {
            return null;
        }
        const urls = Object.keys(this.queuedUrls);
        const idx = Math.floor(Math.random() * urls.length);
        const url = urls[idx];
        delete this.queuedUrls[url];
        this.pendingUrls[url] = true;
        return url;
    }

    finishPendingPage(url: string) {
        delete this.pendingUrls[url]
    }

    shouldRetry(url: string) {
        if (!this.retriedUrls[url]) {
            return true;
        }
        return this.retriedUrls[url] < this.maxRetries;
    }

    incrementRetry(url: string) {
        this.retriedUrls[url] += 1;
    }

    markFailedUrl(url: string, error: string) {
        this.failedUrls[url] = error
    }

    private async savePageHTML(url: string, html: string) {
        const urlSansProtocol = url.replace(/^(http:\/\/|https:\/\/)/,"");
        // Note: we always run this since it's likely that we will need to create paths on-the-fly based on the URL path
        mkDirAllSync(path.join(this.outputDir, path.dirname(urlSansProtocol)));
        fs.writeFileSync(path.join(this.outputDir, urlSansProtocol+".cached"), html);
    }

    async prerender(onDone: (completedPages: { [url: string]: boolean; }, failedPages: { [url: string]: string; }) => void) {
        if (!this.initialized) {
            return Promise.reject("Crawler not setup");
        }

        console.debug("Prerendering ...")
        let indexCp: CrawlPage = {
            url: this.index
        };

        // Note: don't mess with retires on the index -- it should work on the first shot or exit since that's likely a fatal issue
        await this.workers[0].render(indexCp);
        await this.savePageHTML(indexCp.url, indexCp.resultHTML);
        this.queuePages(indexCp.linksTo);
        this.completedPages[indexCp.url] = true;

        let workersReturned = 0;

        const onWorkerExit = () => {
            workersReturned += 1;
            if (this.workers.length == workersReturned) {
                onDone(this.completedPages, this.failedUrls);
            }
        };

        await this.workers.forEach(async worker => {
            while (true) {
                if (!this.queueHasItems() && this.arePagesPending()) {
                    await promisify(setTimeout)(1000);
                    continue;
                } else if (!this.queueHasItems()) {
                    console.debug("No more items in the queue or pending");
                    break;
                }

                let url = this.pullQueuedPage();
                let cp: CrawlPage = {
                    url: url
                };

                // Note: can't use a finally block to execute finish since we need it before to run before potential catch logic...
                try {
                    await worker.render(cp);
                    await this.savePageHTML(cp.url, cp.resultHTML);
                    this.queuePages(cp.linksTo);
                    this.completedPages[cp.url] = true;
                    this.finishPendingPage(url);
                } catch (err) {
                    this.finishPendingPage(url);
                    console.error("Error rendering URL: ", url, " (", err, ")");
                    if (this.shouldRetry(url)) {
                        console.log("Retrying URL: ", url);
                        this.incrementRetry(url);
                        this.forceQueuePage(url);
                    } else {
                        console.log("URL Failed: ", url, " with error: ", err);
                        this.markFailedUrl(url, err);
                    }
                }
            }

            onWorkerExit();
        });
    }
}