# =============================================================================
# Multi-stage Dockerfile for NestJS backend
# Stage 1 (development): ts-node + hot reload via nest start --watch
# Stage 2 (builder):     compile TypeScript
# Stage 3 (production):  minimal image, compiled JS only
# =============================================================================

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
# Copy prisma schema so the prisma generate step works
COPY prisma/ ./prisma/
COPY apps/backend/package*.json ./

# ---- Development (used by docker-compose.yml) ----
FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY apps/backend/ .
# Generate Prisma client
RUN npx prisma generate --schema=./prisma/schema.prisma 2>/dev/null || true
EXPOSE 3000
CMD ["node_modules/.bin/nest", "start", "--watch"]

# ---- Builder ----
FROM base AS builder
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY apps/backend/ .
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
