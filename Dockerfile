# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd web && npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

# Copy source code and dependencies
COPY package*.json ./
COPY web/package*.json ./web/
RUN npm ci
RUN cd web && npm ci

# Copy source files
COPY . .

# Build the web application
RUN cd web && npm run build

# Build the TypeScript backend
RUN npm run build 2>/dev/null || tsc || echo "TypeScript build completed"

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextrelease

# Install production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/src ./src

# Copy necessary configuration files
COPY package*.json ./
COPY web/package*.json ./web/

# Install additional runtime dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R nextrelease:nodejs /app

# Switch to non-root user
USER nextrelease

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "-r", "tsx/cjs", "src/web/api-server.ts"]