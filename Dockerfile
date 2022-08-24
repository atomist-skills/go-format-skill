# Set up build
FROM node:lts@sha256:10c88537539012bd30777e41fdd30b30d088abb6dfc995f77ace26071052d4d1 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional --include=dev \
 && npm run compile \
 && rm -rf node_modules .git

# Set up runtime container
FROM golang:1.18-alpine3.16@sha256:8e45e2ef37d2b6d98900392029db2bc88f42c0f2a9a8035fa7da90014698e86b

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
