FROM exlinc/prerender:latest

ENV PR_WHITELIST_REGEX=".*exlskills\.com\/learn.*"
ENV PR_INDEX_URL="https://exlskills.com/learn-en/dashboard"
ENV PR_WORKERS=4

RUN node /home/pptruser/prerender/index.js prerender

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/home/pptruser/prerender/index.js", "serve-cached"]

