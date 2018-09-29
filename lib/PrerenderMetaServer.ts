import * as express from 'express';
import * as path from 'path';

export class PrerenderMetaServer {
    private app = express();
    private readonly absDir: string;
    private readonly port: number;

    constructor(dir: string, port: number) {
        this.absDir = path.resolve(dir);
        this.port = port;
        this.app.get('/sitemap.xml', this.sitemapHandler);
    }

    sitemapHandler = async (req, res) => {
        try {
            res.setHeader("Content-Type", "text/xml; charset=utf-8")
            res.sendFile(path.join(this.absDir, 'sitemap.xml'));
        } catch(e) {
            console.error("Meta prerender server error: ", e);
            res.status(404).send("Not found");
        }
    }

    serve() {
        this.app.listen(this.port, async () => {
            console.log(`Cached server is running on port ${this.port}`);
        });
    }
}
