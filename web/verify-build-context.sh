#!/bin/bash
# ============================================
# Build Context Verification Script
# Run this in AWS before docker-compose build
# ============================================

set -e

echo "============================================"
echo "NextReleaseMCP - Build Context Verification"
echo "============================================"
echo ""

# Check current directory
echo "📂 Current directory:"
pwd
echo ""

# Check if web directory exists
echo "📁 Checking web directory structure..."
if [ ! -d "web" ]; then
    echo "❌ ERROR: web/ directory not found!"
    echo "   Are you in the project root directory?"
    exit 1
fi
echo "✅ web/ directory exists"
echo ""

# Check critical files
echo "📄 Checking critical files in web/..."
REQUIRED_FILES=(
    "web/package.json"
    "web/package-lock.json"
    "web/Dockerfile"
    "web/index.html"
    "web/vite.config.ts"
    "web/tsconfig.json"
    "web/tailwind.config.js"
    "web/postcss.config.js"
    "web/components.json"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING"
        MISSING_FILES+=("$file")
    fi
done
echo ""

# Check src directory
if [ ! -d "web/src" ]; then
    echo "❌ ERROR: web/src/ directory not found!"
    MISSING_FILES+=("web/src/")
else
    echo "✅ web/src/ directory exists"
    echo "   Files: $(find web/src -type f | wc -l)"
fi
echo ""

# Check public directory
if [ ! -d "web/public" ]; then
    echo "⚠️  WARNING: web/public/ directory not found!"
    echo "   Favicon will not work in production"
else
    echo "✅ web/public/ directory exists"
    if [ -f "web/public/favicon.svg" ]; then
        echo "   ✅ favicon.svg found"
    else
        echo "   ⚠️  favicon.svg not found"
    fi
fi
echo ""

# Check file permissions
echo "🔐 Checking file permissions..."
if [ ! -r "web/index.html" ]; then
    echo "❌ ERROR: index.html is not readable!"
    echo "   Run: chmod +r web/index.html"
    exit 1
fi
echo "✅ Files are readable"
echo ""

# Check docker-compose.yml
echo "🐳 Checking docker-compose.yml..."
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ ERROR: docker-compose.yml not found!"
    exit 1
fi

# Check build context in docker-compose.yml
if grep -q "context: ./web" docker-compose.yml; then
    echo "✅ Build context is set to ./web"
else
    echo "❌ ERROR: Build context not properly configured!"
    exit 1
fi
echo ""

# Summary
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo "============================================"
    echo "✅ All checks passed!"
    echo "============================================"
    echo ""
    echo "You can now run:"
    echo "  docker-compose build web"
    echo "  docker-compose up -d"
    exit 0
else
    echo "============================================"
    echo "❌ Build verification failed!"
    echo "============================================"
    echo ""
    echo "Missing files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Please ensure all files are uploaded to AWS."
    exit 1
fi
