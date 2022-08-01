# Set up build
FROM node:lts@sha256:2e1b4542d4a06e0e0442dc38af1f4828760aecc9db2b95e7df87f573640d98cd AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional --include=dev \
 && npm run compile test \
 && rm -rf node_modules .git

# Set up runtime container
FROM atomist/skill:alpine_3.16-node_16@sha256:45b4a0b5c48576a7269f8b2861ebc05cec1881cfb48abbb21aa8215ccf6bd3c6

LABEL com.docker.skill.api.version="container/v2"
COPY skill.yaml /
COPY datalog /datalog

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
