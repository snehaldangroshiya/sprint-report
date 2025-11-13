# 🐳 Docker Deployment - Quick Start

Production-ready Docker setup for NextReleaseMCP with Node.js server, React client, and Redis cache.

## 🚀 Quick Start (3 Steps)

### 1. Configure Environment

```bash
cp .env.docker.example .env
nano .env  # Add your Jira and GitHub credentials
```

### 2. Build & Start

```bash
docker-compose build
docker-compose up -d
```

### 3. Verify & Access

```bash
# Check status
docker-compose ps

# Access application
Web UI:  http://localhost
API:     http://localhost:3000/api
Health:  http://localhost:3000/api/health
```

## 📦 What's Included

- **API Server** (Node.js + Express) - Port 3000
- **Web Client** (React + Nginx) - Port 80
- **Redis Cache** - Port 6379

## 📚 Documentation

- **[Complete Guide](docs/DOCKER_DEPLOYMENT.md)** - Full deployment documentation
- **[Project Overview](CLAUDE.md)** - Project architecture and features
- **[API Examples](docs/API_WORKING_EXAMPLES.md)** - API usage examples

## 🔧 Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Check health
curl http://localhost:3000/api/health
```

## ⚙️ Required Environment Variables

```bash
# Jira (REQUIRED)
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_token
JIRA_EMAIL=your@email.com

# GitHub (REQUIRED)
GITHUB_TOKEN=ghp_your_token
```

## 🛠️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web UI    │────▶│  API Server │────▶│    Redis    │
│  (Nginx)    │     │  (Node.js)  │     │   (Cache)   │
│   Port 80   │     │  Port 3000  │     │  Port 6379  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 🔐 Security Features

- ✅ Non-root users in all containers
- ✅ Multi-stage builds for minimal attack surface
- ✅ Health checks for all services
- ✅ Resource limits and restart policies
- ✅ CORS protection
- ✅ Security headers (X-Frame-Options, X-XSS-Protection)

## 📊 Performance Features

- ✅ Redis caching (256MB LRU)
- ✅ Nginx gzip compression
- ✅ Asset caching (1 year)
- ✅ Optimized Docker images (Alpine Linux)
- ✅ Multi-stage builds

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Change ports in docker-compose.yml
ports:
  - "8080:3000"  # Use 8080 instead of 3000
```

### Cannot Connect to API

```bash
# Check logs
docker-compose logs api

# Verify health
curl http://localhost:3000/api/health
```

### Redis Connection Failed

```bash
# Check Redis is running
docker-compose ps redis
docker-compose exec redis redis-cli ping
```

## 📈 Monitoring

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f api

# Check resource usage
docker stats

# Check health status
docker inspect nextrelease-api | jq '.[0].State.Health'
```

## 🔄 Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🌐 Production Deployment

For production deployment with HTTPS, custom domains, and advanced configuration, see:
**[docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)**

## 📞 Support

- **Documentation**: See `docs/` folder
- **Issues**: Check logs with `docker-compose logs -f`
- **Health**: `curl http://localhost:3000/api/health`

---

**Version**: 2.2.0  
**Last Updated**: January 2025
