# AWS Ubuntu Docker Deployment - Troubleshooting Guide

## 🚨 Common Error: `COPY index.html ./` Failed

**Error Message:**

```
=> ERROR [web builder 7/12] COPY index.html ./
```

**Root Causes & Solutions:**

---

## 1. Files Not Uploaded to AWS Server

### Problem

Files exist locally but weren't uploaded/synced to AWS Ubuntu instance.

### Solution

**Check files on AWS:**

```bash
# SSH into AWS instance
ssh ubuntu@your-aws-instance

# Navigate to project directory
cd /path/to/nextrelease-mcp

# Run verification script
chmod +x web/verify-build-context.sh
./web/verify-build-context.sh
```

**If files are missing, upload them:**

**Option A: Using SCP**

```bash
# From your local machine
scp -r web/ ubuntu@your-aws-instance:/path/to/nextrelease-mcp/
```

**Option B: Using Git**

```bash
# On AWS instance
git clone https://github.com/your-org/nextrelease-mcp.git
cd nextrelease-mcp
git pull origin main
```

**Option C: Using rsync (recommended for large projects)**

```bash
# From your local machine
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  web/ ubuntu@your-aws-instance:/path/to/nextrelease-mcp/web/
```

---

## 2. Wrong Working Directory

### Problem

Running docker-compose from wrong directory.

### Solution

**Verify you're in project root:**

```bash
# Should show docker-compose.yml
ls -la docker-compose.yml

# Should show web/ directory
ls -la web/

# Should show index.html
ls -la web/index.html
```

**If in wrong directory:**

```bash
cd /path/to/nextrelease-mcp
pwd  # Should show: /path/to/nextrelease-mcp
```

---

## 3. File Permissions Issue

### Problem

Files exist but Docker can't read them (wrong permissions).

### Solution

**Fix permissions:**

```bash
# Make all files readable
chmod -R +r web/

# Make directories executable
chmod -R +X web/

# Verify
ls -la web/index.html
# Should show: -rw-r--r-- or similar
```

---

## 4. Git Line Endings Issue

### Problem

Git converted line endings (CRLF → LF), causing file issues in Ubuntu.

### Solution

**Configure Git properly:**

```bash
# On AWS Ubuntu instance
cd /path/to/nextrelease-mcp

# Configure Git to preserve line endings
git config core.autocrlf false

# Re-checkout files
git checkout --force HEAD
```

**.gitattributes file (add to project root):**

```gitattributes
# Ensure shell scripts use LF
*.sh text eol=lf

# Ensure Dockerfile uses LF
Dockerfile text eol=lf
docker-compose.yml text eol=lf

# Let Git handle other text files
* text=auto
```

---

## 5. .dockerignore Excluding Files

### Problem

.dockerignore accidentally excluding required files.

### Solution

**Check .dockerignore:**

```bash
cat web/.dockerignore | grep -E "(index|html|public)"
```

**Should NOT see:**

- `index.html`
- `*.html`
- `public/`

**If found, remove those lines from web/.dockerignore**

---

## 6. Build Context Issue

### Problem

docker-compose.yml has wrong build context.

### Solution

**Verify docker-compose.yml:**

```bash
grep -A 5 "web:" docker-compose.yml
```

**Should show:**

```yaml
web:
  build:
    context: ./web # ← Must be ./web
    dockerfile: Dockerfile # ← Must be Dockerfile
```

**If wrong, fix docker-compose.yml:**

```yaml
services:
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
```

---

## 7. Docker Cache Issue

### Problem

Docker using old cached layer that doesn't have index.html.

### Solution

**Clear Docker cache and rebuild:**

```bash
# Stop containers
docker-compose down

# Remove old images
docker-compose rm -f web

# Clear build cache
docker builder prune -af

# Rebuild without cache
docker-compose build --no-cache web

# Start services
docker-compose up -d
```

---

## 8. Disk Space Full

### Problem

AWS instance out of disk space, Docker can't write files.

### Solution

**Check disk space:**

```bash
df -h
```

**If disk is full (>90%), clean up:**

```bash
# Remove unused Docker resources
docker system prune -af

# Remove old images
docker image prune -af

# Remove old containers
docker container prune -f

# Remove old volumes
docker volume prune -f

# Check again
df -h
```

---

## 🛠️ Step-by-Step Diagnostic Procedure

### Step 1: Verify Files on AWS

```bash
# SSH into AWS
ssh ubuntu@your-aws-instance

# Navigate to project
cd /path/to/nextrelease-mcp

# Run verification
./web/verify-build-context.sh
```

**Expected output:**

```
✅ All checks passed!
```

**If failed:** Follow output instructions to fix missing files.

---

### Step 2: Check Docker Build Context

```bash
# From project root
cat docker-compose.yml | grep -A 3 "context"

# Should show:
#   context: ./web
#   dockerfile: Dockerfile
```

---

### Step 3: Test Individual COPY Commands

```bash
# Create test Dockerfile
cat > web/Dockerfile.test <<'EOF'
FROM node:20-alpine
WORKDIR /app

# Test each COPY individually
COPY package.json ./
RUN echo "✅ package.json copied"

COPY index.html ./
RUN echo "✅ index.html copied"

COPY src ./src
RUN echo "✅ src/ copied"
EOF

# Test build
docker build -f web/Dockerfile.test web/

# If this works, the problem is in the full Dockerfile
# If this fails, files aren't available in build context
```

---

### Step 4: Build with Verbose Output

```bash
# Build with progress output
docker-compose build --progress=plain web 2>&1 | tee build.log

# Check log for errors
cat build.log | grep -i error
cat build.log | grep -i "COPY index"
```

---

### Step 5: Verify Build Context Contents

```bash
# Create temporary Dockerfile to list context
cat > web/Dockerfile.debug <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY . ./
RUN ls -laR
EOF

# Build and see what's in context
docker build -f web/Dockerfile.debug web/
```

---

## 🚀 Recommended AWS Deployment Workflow

### Initial Setup

```bash
# 1. SSH into AWS instance
ssh ubuntu@your-aws-instance

# 2. Install dependencies
sudo apt update
sudo apt install -y git docker.io docker-compose

# 3. Clone repository
git clone https://github.com/your-org/nextrelease-mcp.git
cd nextrelease-mcp

# 4. Configure environment
cp .env.example .env
nano .env  # Edit with your credentials

# 5. Verify build context
chmod +x web/verify-build-context.sh
./web/verify-build-context.sh

# 6. Build services
docker-compose build --no-cache

# 7. Start services
docker-compose up -d

# 8. Check logs
docker-compose logs -f web
```

---

### Updating Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Verify files
./web/verify-build-context.sh

# 3. Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 4. Verify services
docker-compose ps
curl -I http://localhost/health
```

---

## 🔍 Advanced Debugging

### Enable Docker BuildKit Debug

```bash
# Enable BuildKit with debug
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# Build with full output
docker-compose build web 2>&1 | tee debug.log

# Analyze log
grep -C 5 "COPY index.html" debug.log
```

### Inspect Build Context

```bash
# Create tar of build context (what Docker sees)
cd web
tar -czf ../web-context.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  .

# Check tar contents
tar -tzf ../web-context.tar.gz | grep index.html
# Should show: ./index.html

# If empty, files aren't in context
```

### Check Docker Daemon Logs

```bash
# Ubuntu/Debian
sudo journalctl -u docker -n 100

# Look for errors related to file operations
sudo journalctl -u docker | grep -i error
```

---

## ✅ Quick Fix Checklist

Run through this checklist on AWS:

```bash
# 1. ✅ Am I in the project root?
pwd  # Should show /path/to/nextrelease-mcp

# 2. ✅ Does web/index.html exist?
ls -la web/index.html

# 3. ✅ Is it readable?
cat web/index.html | head -n 5

# 4. ✅ Is build context correct?
grep "context:" docker-compose.yml

# 5. ✅ Is .dockerignore okay?
grep -E "index|html" web/.dockerignore || echo "Not excluded ✅"

# 6. ✅ Do I have disk space?
df -h | grep -E "/$|Filesystem"

# 7. ✅ Can I build locally in web/?
cd web && docker build -t test . && cd ..

# 8. ✅ Clean cache and retry
docker builder prune -af && docker-compose build --no-cache web
```

---

## 📝 Prevention Best Practices

### 1. Use Verification Script

Always run before building:

```bash
./web/verify-build-context.sh
```

### 2. Use Git for Deployment

```bash
# On AWS, always use Git
git pull origin main
docker-compose up -d --build
```

### 3. Automate Deployment

**deploy.sh:**

```bash
#!/bin/bash
set -e

echo "🚀 Deploying NextReleaseMCP to AWS..."

# Verify files
./web/verify-build-context.sh

# Clean Docker cache
docker system prune -f

# Build and deploy
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Health check
sleep 10
curl -f http://localhost/health || exit 1

echo "✅ Deployment successful!"
```

### 4. Monitor Disk Space

**cron job:**

```bash
# Add to crontab: crontab -e
0 * * * * df -h | grep -E "/$" | awk '{if ($5+0 > 90) print "ALERT: Disk usage "$5}'
```

---

## 🆘 Still Having Issues?

### Collect Diagnostic Information

```bash
# Run this and send output for help
cat > diagnostic.sh <<'EOF'
#!/bin/bash
echo "=== System Info ==="
uname -a
df -h

echo -e "\n=== Docker Info ==="
docker version
docker-compose version

echo -e "\n=== Project Structure ==="
pwd
ls -la
ls -la web/

echo -e "\n=== File Check ==="
test -f web/index.html && echo "✅ index.html exists" || echo "❌ index.html missing"
test -d web/src && echo "✅ src/ exists" || echo "❌ src/ missing"

echo -e "\n=== Build Context ==="
grep -A 5 "web:" docker-compose.yml

echo -e "\n=== .dockerignore ==="
cat web/.dockerignore | head -n 20
EOF

chmod +x diagnostic.sh
./diagnostic.sh > diagnostic-output.txt

# Send diagnostic-output.txt for help
cat diagnostic-output.txt
```

---

**Last Updated:** January 13, 2025
**Status:** ✅ Production Ready
