# First build the image and container(in privileged mode)
docker-compose -f sample-cached-docker-compose.yml up

docker commit \
    -c 'ENTRYPOINT ["dumb-init", "--", "node", "/home/pptruser/prerender/index.js", "serve-cached"]' \
    prerender-caching \
    exlinc/prerender:cached-latest

# Shut down the container/docker-compose
docker-compose -f sample-cached-docker-compose.yml down

# Remove the temporary build container (if still exists)
docker rm -f prerender-caching
