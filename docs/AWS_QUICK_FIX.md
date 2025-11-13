# AWS Deployment - Quick Fix Guide

## ✅ Issue Resolved

**Problem**: `web/index.html` and `web/public/` were missing on AWS
**Root Cause**: .gitignore was excluding these files
**Status**: ✅ Fixed and pushed

---

## 🚀 Deploy on AWS Now

Run these commands on your AWS Ubuntu instance:

```bash
# 1. Navigate to project
cd ~/data/sprint-report

# 2. Pull latest changes (includes index.html and public/)
git pull origin master

# 3. Verify files are present
./web/verify-build-context.sh

# 4. Clean and rebuild Docker
docker-compose down
docker builder prune -af
docker-compose build --no-cache

# 5. Start services
docker-compose up -d

# 6. Check health
docker-compose ps
curl -I http://localhost/health
curl -I http://localhost/favicon.svg
```

---

## ✅ Expected Results

### After `git pull`:

```
✅ web/index.html (26 lines)
✅ web/public/favicon.svg (5 lines)
✅ web/public/README.md (102 lines)
```

### After `./web/verify-build-context.sh`:

```
============================================
✅ All checks passed!
============================================

You can now run:
  docker-compose build web
  docker-compose up -d
```

### After `docker-compose up -d`:

```
✅ nextrelease-redis   (healthy)
✅ nextrelease-api     (healthy)
✅ nextrelease-web     (healthy)
```

### Browser Test:

- Visit: `http://your-aws-ip/`
- Check: Favicon "SR" logo appears in browser tab
- Test: All pages load correctly

---

## 🔍 What Was Fixed

### Commits Pushed:

**1. Commit 38f7792**: Docker build improvements

- Fixed Dockerfile to copy `public/` directory
- Added build verification steps
- Created troubleshooting guide
- Created verification script

**2. Commit 98c9e31**: Added missing files

- Updated .gitignore with exceptions for `web/`
- Added `web/index.html` (React app entry point)
- Added `web/public/favicon.svg` (app icon)
- Added `web/public/README.md` (setup guide)

### .gitignore Changes:

**Before:**

```gitignore
*.html          # ← Excluded ALL HTML files
public/         # ← Excluded ALL public directories
```

**After:**

```gitignore
*.html
!web/index.html        # ← Exception for web app
!web/**/*.html

public/
!web/public/           # ← Exception for web app
!web/public/**
```

---

## 📋 Verification Checklist

On AWS, verify each step:

- [ ] Git pull successful (no errors)
- [ ] `web/index.html` exists
- [ ] `web/public/favicon.svg` exists
- [ ] `./web/verify-build-context.sh` passes all checks
- [ ] Docker build completes without errors
- [ ] All 3 containers are healthy
- [ ] Web UI loads at `http://your-aws-ip/`
- [ ] Favicon appears in browser tab
- [ ] API health check returns 200: `curl http://localhost/api/health`

---

## 🆘 If Still Having Issues

### Issue: Git pull fails

```bash
# Stash local changes
git stash
git pull origin master
git stash pop
```

### Issue: Verification script still fails

```bash
# List what's actually there
ls -la web/
ls -la web/public/

# Check git log
git log --oneline -3

# Verify you're on master
git branch
```

### Issue: Docker build fails

```bash
# Clean everything
docker system prune -af
docker volume prune -f

# Rebuild from scratch
docker-compose build --no-cache --pull

# Check logs if build fails
docker-compose build web 2>&1 | tee build.log
cat build.log
```

### Issue: Containers not healthy

```bash
# Check logs
docker-compose logs web
docker-compose logs api
docker-compose logs redis

# Check specific container
docker logs nextrelease-web --tail 50
```

---

## 📞 Support

If you encounter issues:

1. **Run diagnostic script** (from AWS_DEPLOYMENT_TROUBLESHOOTING.md):

   ```bash
   ./diagnostic.sh > diagnostic-output.txt
   cat diagnostic-output.txt
   ```

2. **Check recent commits**:

   ```bash
   git log --oneline -5 --stat
   ```

3. **Verify file contents**:
   ```bash
   head -n 5 web/index.html
   cat web/public/favicon.svg
   ```

---

**Last Updated**: November 13, 2025 @ 20:36 IST
**Status**: ✅ Ready to Deploy
**Files Pushed**: 2 commits, 4 files added/modified
