# Public Assets Directory

This directory contains static assets that are served directly by Vite and included in the Docker build.

## Adding Your Favicon

### Required Files

Place the following favicon files in this directory:

1. **favicon.ico** (16x16 or 32x32) - Classic ICO format for older browsers
2. **favicon-16x16.png** - 16x16 PNG for modern browsers
3. **favicon-32x32.png** - 32x32 PNG for modern browsers
4. **apple-touch-icon.png** - 180x180 PNG for iOS devices

### Generating Favicon Files

You can use online tools to generate all required formats from a single image:

- **[favicon.io](https://favicon.io/)** - Generate from text, image, or emoji
- **[RealFaviconGenerator](https://realfavicongenerator.net/)** - Comprehensive favicon generator
- **[Favicon Generator](https://www.favicon-generator.org/)** - Simple online generator

### Quick Start (Using an Existing Image)

If you have a logo or image file (PNG, JPG, SVG):

1. Visit https://favicon.io/favicon-converter/
2. Upload your image
3. Download the generated package
4. Copy these files to this directory:
   - `favicon.ico`
   - `favicon-16x16.png`
   - `favicon-32x32.png`
   - `apple-touch-icon.png`

### Docker Build Process

**No changes to docker-compose.yml are needed!**

The favicon files are automatically handled by:

1. **Development** (`npm run dev`):
   - Vite serves files from this directory at the root URL
   - Changes are hot-reloaded

2. **Docker Build** (`docker-compose up --build`):
   - Vite bundles all assets during `npm run build`
   - Built files are copied to Nginx's `/usr/share/nginx/html`
   - Nginx serves the favicon at the root URL

### Verification

After adding your favicon files:

**Local Development:**

```bash
cd web
npm run dev
# Visit http://localhost:3002
# Check browser tab for favicon
```

**Docker Production:**

```bash
docker-compose up --build
# Visit http://localhost
# Check browser tab for favicon
```

### Current Configuration

The `index.html` already includes these favicon references:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

### File Structure

```
web/
├── public/               # ← This directory
│   ├── favicon.ico       # Add this file
│   ├── favicon-16x16.png # Add this file
│   ├── favicon-32x32.png # Add this file
│   └── apple-touch-icon.png # Add this file
├── index.html            # ✅ Already configured
└── Dockerfile            # ✅ No changes needed
```

## Notes

- Files in this directory are served at the **root URL** (e.g., `/favicon.ico`)
- Do not reference files as `/public/favicon.ico` - use `/favicon.ico`
- The Dockerfile automatically includes these files in the build
- No changes to docker-compose.yml are required
