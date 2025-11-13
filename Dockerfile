# ============================================
# NextReleaseMCP - Backend Server Dockerfile
# Production-ready multi-stage build
# ============================================

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    pixman-dev \
    jpeg-dev \
    giflib-dev \
    freetype-dev

# Copy package files
COPY package.json package-lock.json ./

# Verify files copied correctly
RUN ls -la && \
    node --version && \
    npm --version

# Install ALL dependencies (needed for build)
RUN npm install && npm cache clean --force

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 3: Production Dependencies
# ============================================
FROM node:20-alpine AS prod-deps

WORKDIR /app

# Install build dependencies for native modules
# bcrypt: python3, make, g++
# canvas: cairo, pango, pixman, jpeg, gif, freetype
# puppeteer: chromium (but we skip chromium download, see below)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    pixman-dev \
    jpeg-dev \
    giflib-dev \
    freetype-dev

# Copy package files
COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN npm install --production && npm cache clean --force

# Remove build dependencies to reduce image size (keep runtime libs)
RUN apk del python3 make g++

# ============================================
# Stage 4: Production Runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for native modules
# canvas requires cairo, pango, pixman, jpeg, gif at runtime
RUN apk add --no-cache \
    cairo \
    pango \
    pixman \
    jpeg \
    giflib \
    freetype

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy package.json for module-alias and version info
COPY --chown=nodejs:nodejs package.json ./

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    ENABLE_API_LOGGING=true

# Expose API port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the Web API server (not MCP stdio server)
CMD ["node", "dist/web-server.js"]