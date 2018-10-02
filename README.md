[![Docker Automated build](https://img.shields.io/docker/automated/jrottenberg/ffmpeg.svg)](https://hub.docker.com/r/exlinc/prerender/)

# Prerender Single Page Apps (ReactJS, AngularJS, VueJS) for SEO

The EXL Inc. `prerender` server offers a simple configuration-free Dockerized server for prerendering single page apps for search engines, bots, and other automated systems that suck at/cannot render SPAs properly. The server uses `puppeteer` (which in turn uses headless google chrome) to actually render the pages.

## Features

* Crawl and save entire site ahead of time -- this will give you significantly higher ranking due to super fast page load times

* Automatically generate a `sitemap.xml` file with all indexed pages. This is used by search engines to help speed up indexing

* Serve prerendered (cached) site

* Serve cached metadata (`sitemap.xml`)

* Serve live -- this is the most expensive option as it will run the render process each time it receives a request

## Roadmap

* Add option to render on the fly when a request for a whitelisted page arrives but it is not found in the cache (right now the search engine would get a 404)

* Add option to continuously update the cache on a schedule (right now this is typically done by rebuilding the docker image with a cron job)

## Running

The easiest way is to get started with the prebuilt docker image running the live server (slowest option, but zero configuration required!):

```bash
docker run --cap-add SYS_ADMIN --rm -it -p 3000:3000 exlinc/prerender
```

This will run the server on port 3000 on your machine. The `SYS_ADMIN` capability is required for the puppeteer (Chromium) rendering process.

You can also run it locally (assuming you have google chrome installed)

```bash
git clone https://github.com/exlinc/prerender
cd prerender
# You must install yarn for this project, if you don't already have it, run: npm install -g yarn
yarn install
yarn start
```

## Getting a prerendered page

Once you have the server running you can call it like this (assuming it's running on localhost:3000):

If you go into your browser and navigate to, `http://localhost:3000/http://example.com/`, for example, you will get a prerendered version of that page. You can replace `http://example.com/` with your site's address and you will get the prerendered page.

## Building up your cached site

To build an image with a cache built in (for easy distribution on ECS/K8s), you can check out the `sample-cached-docker-compose.yml` file and the `sample-cached-build.sh` script. This sample will render and write to an image all of the pages that it is directed to index based on the `PR_WHITELIST_REGEX` starting at the `PR_INDEX_URL`. It will output a ready-to-run image called `exlinc/prerender:cached-latest` (you change the name in the script later) that will have all of your data ready for serving.

## Run a cached site image

Assuming the name of your cached image is `exlinc/prerender:cached-latest`, as is the default, it would look something like this:

```bash
# Port 4000 serves the cached pages
# Port 5000 serves the metadata (sitemap.xml)
docker run --rm -d -p 4000:4000 -p 5000:5000 exlinc/prerender:cached-latest
```

And you can test it out like this:

```bash
# Get your sitemap.xml
curl http://localhost:5000/sitemap.xml
# Get a page (must be in the cache)
curl http://localhost:4000/https://exlskills.com/learn-en/dashboard
```

## Setup behind nginx

This is an example HTTP nginx config that runs behind an SSL-terminating load balancer (like AWS ALB). However, you can easily add HTTPS to the config via the letsencrypt bot or just by manually inserting and configuring the certs+listener.

It will take traffic from known bots and route that to the prerender server, while routing user traffic to your HTML resources. Requests for static files (like JS/CSS/images) bypass prerender and are served by nginx. Check out the [EXLskills Web Client source](https://github.com/exlskills/web-client) for a full example+docker.

```
server {
    listen       80 default_server;
    server_name  _;

    #charset koi8-r;
    #access_log  /var/log/nginx/host.access.log  main;


    root  /usr/share/nginx/html;
    index /index.html;
    
    location /sitemap.xml {
        # NOTE: The prerender container is linked to the nginx container in docker
        proxy_pass http://prerender:5000;
    }

    location / {
        try_files $uri @botexl;
    }

    location @botexl {
        set $prerender 0;
        if ($http_user_agent ~* "googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator") {
            set $prerender 1;
        }
        if ($args ~ "_escaped_fragment_") {
            set $prerender 1;
        }
        if ($http_user_agent ~ "bot-exlpre") {
            set $prerender 0;
        }
        if ($uri ~* "\.(js|css|xml|less|png|jpg|jpeg|gif|pdf|doc|txt|ico|rss|zip|mp3|rar|exe|wmv|doc|avi|ppt|mpg|mpeg|tif|wav|mov|psd|ai|xls|mp4|m4a|swf|dat|dmg|iso|flv|m4v|torrent|ttf|woff|svg|eot)") {
            set $prerender 0;
        }
        if ($prerender = 1) {
            rewrite .* /$scheme://$host$request_uri? break;
            # NOTE: This assumes that the prerender container is linked to the nginx container in docker
            proxy_pass http://prerender:4000;
        }
        if ($prerender = 0) {
            rewrite .* /learn/index.html break;
        }
    }

    #error_page  404              /404.html;

    # redirect server error pages to the static page /50x.html
    #
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }

    # proxy the PHP scripts to Apache listening on 127.0.0.1:80
    #
    #location ~ \.php$ {
    #    proxy_pass   http://127.0.0.1;
    #}

    # pass the PHP scripts to FastCGI server listening on 127.0.0.1:9000
    #
    #location ~ \.php$ {
    #    root           html;
    #    fastcgi_pass   127.0.0.1:9000;
    #    fastcgi_index  index.php;
    #    fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;
    #    include        fastcgi_params;
    #}

    # deny access to .htaccess files, if Apache's document root
    # concurs with nginx's one
    #
    location ~ /\.ht {
        deny  all;
    }
}
```

## Using in production

We use this project in production, however, keep in mind that it is in it's early stages and may not support all edge cases.

## Planning resource usage for live/on-the-fly rendering

When using an option that renders in real time, you should allocate at least 1vCPU and 1GB to 1.5GB of RAM per prerender container, otherwise chrome is unlikely to have enough resources to properly render your pages (assuming you have a realistic ReactJS/AngularJS/VueJS application that loads resources and renders a substantial application). The containers may also crash due to chrome errors/load, so we recommend that you run them with some sort of an auto-restart functionality (such as on AWS ECS or kubernetes).
