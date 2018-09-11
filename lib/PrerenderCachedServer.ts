import * as express from 'express';
import * as path from 'path';

export class PrerenderCachedServer {
    private app = express();
    private readonly absDir: string;
    private readonly port: number;

    constructor(dir: string, port = 3000) {
        this.absDir = path.resolve(dir);
        this.port = port;
        this.app.get('*', this.handler);
    }

    handler = async (req, res) => {
        try {
            res.setHeader("Content-Type", "text/html; charset=utf-8")
            res.sendFile(path.join(this.absDir, req.originalUrl.substring(1).replace(/^(http:\/\/|https:\/\/)/,"")+".cached"));
        } catch(e) {
            console.error("Cached prerender server error: ", e);
            res.status(404).send("Not found");
        }
    }

    serve() {
        this.app.listen(this.port, async () => {
            console.log(`Cached server is running on port ${this.port}`);
        });
    }
}
