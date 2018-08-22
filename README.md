# Prerender Single Page Apps (ReactJS, AngularJS, VueJS) for SEO

The EXL Inc. `prerender` server offers a simple configuration-free Dockerized server for prerendering single page apps for search engines, bots, and other automated systems that suck at/cannot render SPAs properly.

## Running

The easiest way is to get started with the prebuilt docker image:

```bash
docker run --rm -it -p 3000:3000 exlinc/prerender
```

This will run the server on port 3000 on your machine.

You can also run it locally (assuming you have google chrome installed)

```bash
git clone https://github.com/exlinc/prerender
cd prerender
npm install
npm start
```

## Getting a prerendered page

Once you have the server running you can call it like this (assuming it's running on localhost:3000):

If you go into your browser and navigate to, `http://localhost:3000/http://example.com/`, for example, you will get a prerendered version of that page. You can replace `http://example.com/` with your site's address and you will get the prerendered page.

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
            proxy_pass http://prerender:3000;
            # NOTE: You can use this for localhost, and then comment out the above proxy_pass and uncomment the one below
            proxy_pass http://localhost:3000;
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

We use this project in production, however, keep in mind that it is in it's early stages and may not support all edge cases. Also note that when you run this in production, you should allocate at least 1vCPU and 1GB to 1.5GB of RAM per prerender container, otherwise chrome is unlikely to have enough resources to properly render your pages (assuming you have a realistic ReactJS/AngularJS/VueJS application that loads resources and renders a substantial application). The containers may also crash due to chrome errors/load, so we recommend that you run them with some sort of an auto-restart functionality (such as on AWS ECS or kubernetes). 
