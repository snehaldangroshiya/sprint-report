# Docker Deployment Guide

Complete guide for deploying NextReleaseMCP using Docker and Docker Compose.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Services Architecture](#services-architecture)
- [Production Deployment](#production-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Overview

The Docker setup includes three main services:

1. **API Server** (Node.js + Express) - Port 3000
2. **Web Client** (React + Nginx) - Port 80
3. **Redis Cache** - Port 6379

All services run in isolated containers with health checks, automatic restarts, and optimized multi-stage builds.

## Prerequisites

### Required Software

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ (included with Docker Desktop)
- 2GB+ free disk space
- 1GB+ available RAM

### Required Credentials

- Jira Server API token
- Jira email address
- GitHub Personal Access Token (PAT)

### Verify Installation

```bash
docker --version          # Should be 20.10+
docker-compose --version  # Should be 2.0+
```

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd sprint-report

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Required Environment Variables

Edit `.env` with your credentials:

```bash
# Jira Configuration (REQUIRED)
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_jira_bearer_token_here
JIRA_EMAIL=your.email@company.com

# GitHub Configuration (REQUIRED)
GITHUB_TOKEN=ghp_your_github_token_here

# Web Client Configuration (OPTIONAL)
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GITHUB_OWNER=your-org
VITE_GITHUB_REPO=your-repo
```

### 3. Build and Start

```bash
# Build all services
docker-compose build

# Start all services in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Verify Deployment

```bash
# Check service status
docker-compose ps

# Check health
curl http://localhost:3000/api/health  # API health
curl http://localhost/health           # Web health

# View logs
docker-compose logs api   # API logs
docker-compose logs web   # Web logs
docker-compose logs redis # Redis logs
```

### 5. Access Application

- **Web UI**: http://localhost
- **API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health
- **Redis**: localhost:6379

## Configuration

### Environment Variables Reference

#### Node.js API Server

| Variable                | Required | Default               | Description                           |
| ----------------------- | -------- | --------------------- | ------------------------------------- |
| `NODE_ENV`              | No       | `production`          | Node environment                      |
| `PORT`                  | No       | `3000`                | API server port                       |
| `LOG_LEVEL`             | No       | `info`                | Logging level (error/warn/info/debug) |
| `ENABLE_API_LOGGING`    | No       | `true`                | Enable API request logging            |
| `JIRA_BASE_URL`         | **Yes**  | -                     | Jira Server base URL                  |
| `JIRA_API_TOKEN`        | **Yes**  | -                     | Jira Bearer token                     |
| `JIRA_EMAIL`            | **Yes**  | -                     | Jira account email                    |
| `GITHUB_TOKEN`          | **Yes**  | -                     | GitHub PAT                            |
| `REDIS_HOST`            | No       | `redis`               | Redis hostname                        |
| `REDIS_PORT`            | No       | `6379`                | Redis port                            |
| `REDIS_DB`              | No       | `0`                   | Redis database number                 |
| `REDIS_PASSWORD`        | No       | -                     | Redis password (if required)          |
| `MEMORY_CACHE_MAX_SIZE` | No       | `100`                 | Memory cache max entries              |
| `MEMORY_CACHE_TTL`      | No       | `300`                 | Memory cache TTL (seconds)            |
| `ALLOWED_ORIGINS`       | No       | `http://localhost:80` | CORS allowed origins                  |

#### React Web Client

| Variable            | Required | Default                     | Description              |
| ------------------- | -------- | --------------------------- | ------------------------ |
| `VITE_API_BASE_URL` | No       | `http://localhost:3000/api` | API base URL             |
| `VITE_GITHUB_OWNER` | No       | -                           | GitHub organization/user |
| `VITE_GITHUB_REPO`  | No       | -                           | GitHub repository name   |

#### Redis Cache

| Variable          | Required | Default       | Description          |
| ----------------- | -------- | ------------- | -------------------- |
| `REDIS_MAXMEMORY` | No       | `256mb`       | Maximum memory usage |
| `REDIS_POLICY`    | No       | `allkeys-lru` | Eviction policy      |

### Custom Port Configuration

To use different ports, modify `docker-compose.yml`:

```yaml
services:
  api:
    ports:
      - '8080:3000' # External:Internal

  web:
    ports:
      - '8000:80' # External:Internal
```

## Services Architecture

### 1. Redis Cache Server

**Purpose**: High-performance caching layer

**Configuration**:

- Image: `redis:7-alpine`
- Port: 6379
- Memory: 256MB with LRU eviction
- Health Check: `redis-cli ping`

**Volumes**:

- `redis-data`: Persistent data storage
- `redis-conf`: Configuration files

### 2. API Server (Node.js)

**Purpose**: Backend REST API and MCP server

**Configuration**:

- Base Image: `node:20-alpine`
- Port: 3000
- Multi-stage build (4 stages)
- Non-root user: `nodejs` (UID 1001)
- Health Check: HTTP GET `/api/health`

**Build Stages**:

1. **deps**: Install all dependencies
2. **builder**: Build TypeScript → JavaScript
3. **prod-deps**: Install production-only dependencies
4. **runner**: Final optimized image

**Volumes**:

- `./logs:/app/logs` - Application logs
- `./data:/app/data` - Application data

### 3. Web Client (React + Nginx)

**Purpose**: Frontend web application

**Configuration**:

- Build Image: `node:20-alpine`
- Runtime Image: `nginx:alpine`
- Port: 80
- Multi-stage build (3 stages)
- Non-root user: `nginx`
- Health Check: HTTP GET `/health`

**Build Stages**:

1. **deps**: Install npm dependencies
2. **builder**: Build React app with Vite
3. **runner**: Serve with Nginx

**Features**:

- Gzip compression
- Security headers
- Asset caching (1 year)
- SPA routing fallback
- Optional API proxy

## Production Deployment

### 1. Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Jira and GitHub credentials tested
- [ ] Docker and Docker Compose installed
- [ ] Sufficient disk space (2GB+)
- [ ] Sufficient RAM (1GB+)
- [ ] Firewall rules configured (if applicable)
- [ ] SSL certificates prepared (if using HTTPS)

### 2. Build for Production

```bash
# Build with no cache (fresh build)
docker-compose build --no-cache

# Pull latest base images
docker-compose pull

# Build and start
docker-compose up -d --build
```

### 3. Production Environment Variables

Create a production `.env.production`:

```bash
# Production settings
NODE_ENV=production
LOG_LEVEL=error
ENABLE_API_LOGGING=false

# Your production credentials
JIRA_BASE_URL=https://jira.yourcompany.com
JIRA_API_TOKEN=prod_token_here
JIRA_EMAIL=prod.email@company.com
GITHUB_TOKEN=ghp_prod_token_here

# Production API URL (use your domain)
VITE_API_BASE_URL=https://api.yourcompany.com/api

# Redis with password
REDIS_PASSWORD=your_secure_redis_password

# Restrict CORS
ALLOWED_ORIGINS=https://yourcompany.com,https://www.yourcompany.com
```

Use it with:

```bash
docker-compose --env-file .env.production up -d
```

### 4. Using HTTPS with Nginx Reverse Proxy

Create `nginx-proxy.conf`:

```nginx
upstream api_backend {
    server api:3000;
}

upstream web_frontend {
    server web:80;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # API
    location /api/ {
        proxy_pass http://api_backend/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Web
    location / {
        proxy_pass http://web_frontend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Add to `docker-compose.yml`:

```yaml
services:
  nginx-proxy:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx-proxy.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
      - web
    networks:
      - nextrelease-network
```

### 5. Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M

  web:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## Monitoring & Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100 api

# Since timestamp
docker-compose logs --since 2025-01-01T00:00:00 api
```

### Check Service Status

```bash
# List running containers
docker-compose ps

# Check container stats (CPU, memory)
docker stats

# Inspect container
docker-compose exec api sh
docker-compose exec web sh
docker-compose exec redis redis-cli
```

### Health Checks

```bash
# API health
curl http://localhost:3000/api/health | jq

# Web health
curl http://localhost/health

# Redis health
docker-compose exec redis redis-cli ping

# Detailed health
docker inspect nextrelease-api | jq '.[0].State.Health'
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart web
docker-compose restart redis

# Stop all services
docker-compose stop

# Start all services
docker-compose start
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Or using --build flag
docker-compose up -d --build
```

### Backup and Restore

#### Backup Redis Data

```bash
# Create backup
docker-compose exec redis redis-cli SAVE
docker cp nextrelease-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb

# Or use docker volume backup
docker run --rm -v nextrelease-redis-data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
```

#### Restore Redis Data

```bash
# Stop Redis
docker-compose stop redis

# Restore backup
docker run --rm -v nextrelease-redis-data:/data -v $(pwd)/backups:/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data

# Start Redis
docker-compose start redis
```

#### Backup Application Data

```bash
# Backup logs and data
tar czf backup-$(date +%Y%m%d).tar.gz logs/ data/
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove containers, volumes, and images
docker-compose down -v --rmi all

# Clean up unused Docker resources
docker system prune -a --volumes
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Problem**: `Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use`

**Solution**:

```bash
# Find process using port
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill process or change port in docker-compose.yml
ports:
  - "8080:3000"  # Use different external port
```

#### 2. Cannot Connect to API

**Problem**: Web client shows connection errors

**Solution**:

```bash
# Check API is running
docker-compose ps api

# Check API logs
docker-compose logs api

# Verify API health
curl http://localhost:3000/api/health

# Check CORS settings
docker-compose logs api | grep CORS
```

#### 3. Redis Connection Failed

**Problem**: API logs show Redis connection errors

**Solution**:

```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Verify network
docker network inspect nextrelease-network
```

#### 4. Build Failures - Native Dependencies

**Problem**: Build fails with `npm ci --omit=dev` exit code 1

**Common Error**:

```
target api: failed to solve: process "/bin/sh -c npm ci --omit=dev && npm cache clean --force"
did not complete successfully: exit code: 1
```

**Root Cause**: Native dependencies (bcrypt, canvas, puppeteer) require build tools

**Solution**: Already implemented in Dockerfile ✅

- Installs build tools: python3, make, g++
- Installs graphics libraries: cairo, pango, pixman, jpeg, giflib, freetype
- Skips Puppeteer Chromium download (saves 200MB)
- Removes build tools after compilation (saves 100MB)

**See**: [DOCKER_BUILD_FIX.md](./DOCKER_BUILD_FIX.md) for complete details

**If still failing**:

```bash
# Clear Docker cache
docker-compose build --no-cache

# Verify package-lock.json exists
ls -la package-lock.json

# Check disk space
df -h

# Remove old images
docker system prune -a

# Check build logs
docker-compose build api 2>&1 | tee build.log
```

#### 5. Out of Memory

**Problem**: Containers are killed or restarted frequently

**Solution**:

```bash
# Check container memory usage
docker stats

# Increase Redis memory limit in docker-compose.yml
command: redis-server --maxmemory 512mb

# Add resource limits (see Production Deployment section)
```

### Debug Mode

Enable debug logging:

```bash
# Edit docker-compose.yml
environment:
  - LOG_LEVEL=debug
  - ENABLE_API_LOGGING=true

# Restart services
docker-compose restart api
```

### Container Shell Access

```bash
# Access API container
docker-compose exec api sh

# Access Web container
docker-compose exec web sh

# Access Redis CLI
docker-compose exec redis redis-cli
```

### View Container Details

```bash
# Inspect container configuration
docker inspect nextrelease-api

# View container processes
docker-compose top api

# View container resources
docker stats nextrelease-api
```

## Advanced Configuration

### Custom Redis Configuration

Create `redis.conf`:

```conf
# Redis custom configuration
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

Update `docker-compose.yml`:

```yaml
redis:
  command: redis-server /usr/local/etc/redis/redis.conf
  volumes:
    - ./redis.conf:/usr/local/etc/redis/redis.conf
```

### Multiple Environments

Create separate compose files:

```bash
# docker-compose.dev.yml
version: '3.8'
services:
  api:
    environment:
      - LOG_LEVEL=debug

# docker-compose.prod.yml
version: '3.8'
services:
  api:
    environment:
      - LOG_LEVEL=error
```

Use with:

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Automated Deployment with CI/CD

Example GitHub Actions workflow:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Copy files to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          source: '.'
          target: '/app'

      - name: Deploy with Docker Compose
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /app
            docker-compose pull
            docker-compose up -d --build
            docker-compose ps
```

### Horizontal Scaling

For high-traffic scenarios, scale services:

```bash
# Scale API to 3 instances
docker-compose up -d --scale api=3

# Add load balancer (nginx) to distribute traffic
```

## Performance Optimization

### Build Optimization

- Use `.dockerignore` to exclude unnecessary files
- Multi-stage builds reduce final image size
- Layer caching speeds up rebuilds

### Runtime Optimization

- Redis caching reduces API calls
- Nginx gzip compression reduces bandwidth
- Asset caching improves load times
- Health checks ensure service availability

### Image Sizes

- API Server: ~150MB (Node 20 Alpine + dependencies)
- Web Client: ~50MB (Nginx Alpine + static files)
- Redis: ~30MB (Redis 7 Alpine)
- **Total**: ~230MB

## Security Best Practices

1. **Non-root Users**: All containers run as non-root users
2. **Environment Variables**: Never commit `.env` files
3. **HTTPS**: Use SSL/TLS in production
4. **CORS**: Restrict allowed origins
5. **Updates**: Keep base images updated
6. **Secrets**: Use Docker secrets or vault systems
7. **Network Isolation**: Services communicate via internal network
8. **Resource Limits**: Prevent resource exhaustion attacks

## Support

For issues and questions:

- Check logs: `docker-compose logs -f`
- View health: `docker-compose ps`
- Read docs: [Project Documentation](../CLAUDE.md)
- Report issues: GitHub Issues

---

**Last Updated**: January 2025
**Version**: 2.2.0
