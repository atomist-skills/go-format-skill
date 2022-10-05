# Set up build
FROM node:lts@sha256:5968f50bda8ea8bdc65fd4208de287bbb25ca3ba81649494b1b6cf4b9203695e AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional --include=dev \
 && npm run compile \
 && rm -rf node_modules .git

# Set up runtime container
FROM golang:1.19-alpine3.16@sha256:2baa528036c1916b23de8b304083c68fb298c5661203055f2b1063390e3cdddb

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
