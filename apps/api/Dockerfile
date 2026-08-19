# syntax=docker/dockerfile:1

# ── build ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable
WORKDIR /app

# Manifests first, so a dependency install is cached across code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @simulyn/shared... --filter api...

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# The container talks to PostgreSQL, so generate the client from the derived
# postgres schema rather than the SQLite one used in development.
RUN pnpm --filter @simulyn/shared db:postgres:generate \
 && pnpm --filter @simulyn/shared build \
 && pnpm --filter api build

# ── run ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Toolchains for student submissions. Kept in the runtime image on purpose —
# this is what makes C++ and Java work in production.
RUN apk add --no-cache \
      python3 \
      g++ \
      libstdc++ \
      openjdk17-jdk \
      openssl \
      dumb-init \
 && ln -sf /usr/bin/python3 /usr/bin/python

RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    PYTHON_BIN=/usr/bin/python3 \
    CXX_BIN=/usr/bin/g++ \
    JAVAC_BIN=/usr/lib/jvm/java-17-openjdk/bin/javac \
    JAVA_BIN=/usr/lib/jvm/java-17-openjdk/bin/java

# Copied wholesale so pnpm's symlinked node_modules stay intact.
COPY --from=builder /app /app

# Untrusted student code runs here, so never as root.
RUN addgroup -S simulyn && adduser -S simulyn -G simulyn \
 && chown -R simulyn:simulyn /app
USER simulyn

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/docs-json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# dumb-init reaps the compiler and interpreter processes the executor spawns.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
