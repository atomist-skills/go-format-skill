# Set up build
FROM node:lts@sha256:5f21943fe97b24ae1740da6d7b9c56ac43fe3495acb47c1b232b0a352b02a25c AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional --include=dev \
 && npm run compile \
 && rm -rf node_modules .git

# Set up runtime container
FROM golang:1.19-alpine3.16@sha256:7d7cc4682f31c69ac36c34cdbd2a5d1963c7c007ed423b7b58b73613ae085e39

# Install goimports
RUN go install golang.org/x/tools/cmd/goimports@latest

# Install Node.js
RUN apk add --no-cache \
 nodejs=16.16.0-r0

# Install Git
RUN apk add --no-cache \
 git=2.36.2-r0

# ENV VARs needed for Node.js
ENV BLUEBIRD_WARNINGS=0 \
 NODE_ENV=production \
 NODE_NO_WARNINGS=1 \
 NPM_CONFIG_LOGLEVEL=warn \
 SUPPRESS_NO_CONFIG_WARNING=true

LABEL com.docker.skill.api.version="container/v2"
COPY skill.yaml /
COPY datalog /datalog
COPY docs/images/icon.svg /icon.svg

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN apk add --no-cache \
 npm=8.10.0-r0 \
 && npm ci --no-optional \
 && npm cache clean --force \
 && apk del npm
    
COPY --from=build /usr/src/ .

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
