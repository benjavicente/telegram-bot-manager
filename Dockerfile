FROM node:18-alpine as setup
ARG PB_VERSION=0.10.1

# Install pocketbase dependencies and userfull stuff
RUN apk update
RUN apk add --no-cache unzip openssh libc6-compat bash

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@7.19.0 --activate 

# Prepare JS dependencies
COPY pnpm-lock.yaml ./
RUN pnpm fetch

FROM setup as builder
WORKDIR /app

# Build TS
ADD . ./
RUN pnpm install --offline
RUN pnpm run build


FROM setup as runner

# Install pocketbase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/
COPY ./pb_migrations /pb/pb_migrations

# Install JS dependencies
COPY --from=builder /app/dist ./dist
COPY ./package.json ./pnpm-lock.yaml ./
RUN pnpm install --prod --offline
COPY ./docker-entrypoint.sh ./

# Run pocketbase and the app
ENV DB_URL="http://0.0.0.0:5679"
ENTRYPOINT [ "/bin/bash", "./docker-entrypoint.sh" ]