# syntax=docker/dockerfile:1

# ── build ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @simulyn/shared... --filter web...

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# NEXT_PUBLIC_* is inlined at build time, so the API URL must be known here.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# db:generate produces the Prisma types that @simulyn/shared compiles against.
# prebuild copies Monaco into public/, so the editor is served from this origin.
RUN pnpm --filter @simulyn/shared db:generate \
 && pnpm --filter @simulyn/shared build \
 && pnpm --filter web build

# ── run ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder /app /app

RUN addgroup -S simulyn && adduser -S simulyn -G simulyn \
 && chown -R simulyn:simulyn /app
USER simulyn

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "--filter", "web", "start"]
