# syntax=docker/dockerfile:1

# Local dev stack (dev/docker-compose.yml): deps only; bind-mount the monorepo at /app.
FROM node:22-bookworm-slim AS dev

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN rm -f /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && npm install -g corepack@0.34.0 --no-fund --no-audit \
  && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages packages
COPY tools tools
COPY static static
RUN pnpm install --frozen-lockfile

EXPOSE 4000

CMD ["node", "packages/cli/bin/shellui.js", "start", "--host", "--config", "dev/config"]
