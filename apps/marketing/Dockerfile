# syntax=docker/dockerfile:1
# Build context is the repo root (`docker build -f apps/marketing/Dockerfile .`)
# — a pnpm workspace needs the whole tree to resolve `workspace:*` deps.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruned
RUN npm install -g turbo
COPY . .
RUN turbo prune @sanvi/marketing --docker

FROM base AS build
# Prerendering runs the SvelteKit handle chain (and its env validation) at
# build time, so the PUBLIC_* vars must be present here — runtime ENV alone
# comes too late for the prerendered pages. Passed via --build-arg from CI.
ARG PUBLIC_API_ORIGIN
ARG PUBLIC_MEDIA_ORIGIN
ARG PUBLIC_SITE_ORIGIN
ENV PUBLIC_API_ORIGIN=$PUBLIC_API_ORIGIN \
    PUBLIC_MEDIA_ORIGIN=$PUBLIC_MEDIA_ORIGIN \
    PUBLIC_SITE_ORIGIN=$PUBLIC_SITE_ORIGIN
COPY --from=pruned /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruned /repo/out/full/ .
RUN pnpm turbo run build --filter=@sanvi/marketing...

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/marketing/build build
COPY --from=build /repo/apps/marketing/package.json .
COPY --from=build /repo/node_modules /app/node_modules
EXPOSE 3000
USER node
CMD ["node", "build"]
