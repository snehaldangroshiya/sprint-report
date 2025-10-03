# Web UI - Technical Documentation

**Status**: ✅ Production Ready
**Last Updated**: October 2, 2025
**Framework**: React 18 + TypeScript + Vite
**UI Library**: shadcn/ui (100% coverage)

## 📋 Overview

The web UI is a modern React application providing a comprehensive interface for sprint reporting, analytics, and GitHub integration. Built with TypeScript for type safety and using shadcn/ui for consistent, accessible components.

## 🏗️ Architecture

### Technology Stack
- **Frontend Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.2
- **Language**: TypeScript 5.5.3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4.1
- **State Management**: TanStack Query (React Query) 5.56.2
- **Routing**: React Router DOM 6.26.2
- **Charts**: Recharts 2.12.7

### Project Structure
```
web/
├── src/
│   ├── pages/           # Page components (7 files)
│   │   ├── Dashboard.tsx        # Main dashboard with metrics
│   │   ├── ReportGenerator.tsx  # Report creation interface
│   │   ├── ReportViewer.tsx     # Report display & download
│   │   ├── Analytics.tsx        # Charts & analytics
│   │   ├── GitHub.tsx           # GitHub commits & PRs
│   │   ├── Velocity.tsx         # Sprint velocity tracking
│   │   └── ToolsStatus.tsx      # MCP tools health monitoring
│   │
│   ├── components/      # Reusable components
│   │   ├── ui/          # shadcn/ui components (11 files)
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── table.tsx
│   │   │   └── tabs.tsx
│   │   ├── ErrorBoundary.tsx    # Error boundary wrapper
│   │   └── Layout.tsx           # App layout with navigation
│   │
│   ├── lib/
│   │   ├── api.ts              # API client (typed)
│   │   └── utils.ts            # Utility functions (cn helper)
│   │
│   ├── App.tsx         # Root component with routing
│   ├── main.tsx        # Application entry point
│   └── index.css       # Global styles + Tailwind
│
├── public/             # Static assets
├── components.json     # shadcn/ui configuration
├── tailwind.config.js  # Tailwind configuration
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── package.json        # Dependencies & scripts
```

## 🎨 UI Component System

### shadcn/ui Integration (October 2, 2025)

**Migration Status**: ✅ **100% Complete**

All custom UI elements have been replaced with shadcn/ui components for consistency, accessibility, and maintainability.

#### Components Added
```typescript
// Core Components (Already Present)
- Button         // Primary UI interaction
- Card           // Content containers
- Input          // Form inputs
- Label          // Form labels
- Select         // Dropdown selections

// New Components (Added October 2, 2025)
- Alert          // Error/success messages
- Badge          // Status indicators
- Skeleton       // Loading states
- Separator      // Visual dividers
- Tabs           // Tabbed interfaces
- Table          // Data tables
```

#### Component Usage by Page

**Dashboard.tsx**
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Usage: System status cards, metrics display, activity feed
```

**ReportGenerator.tsx**
```typescript
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
// Usage: Form submission, loading states, error messages
```

**ReportViewer.tsx**
```typescript
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// Usage: Download buttons, loading states, error display
```

**Analytics.tsx**
```typescript
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
// Usage: Chart controls, loading placeholders
```

**GitHub.tsx**
```typescript
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
// Usage: Fetch data button, commit/PR loading states
```

**Velocity.tsx**
```typescript
import { Skeleton } from '@/components/ui/skeleton';
// Usage: Velocity chart loading state
```

**ToolsStatus.tsx**
```typescript
import { Button } from '@/components/ui/button';
// Usage: Refresh status button
```

### Button Variants
```typescript
// Primary action (default)
<Button>Generate Report</Button>

// Secondary/neutral actions
<Button variant="outline">Download</Button>

// Destructive actions
<Button variant="destructive">Delete</Button>

// Subtle actions
<Button variant="ghost">Cancel</Button>

// Link-style actions
<Button variant="link">Learn More</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Alert Patterns
```typescript
// Error messages
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Error message here</AlertDescription>
</Alert>

// Success messages
<Alert>
  <CheckCircle className="h-4 w-4" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Success message here</AlertDescription>
</Alert>

// Info/warning messages
<Alert variant="warning">
  <AlertDescription>Warning message here</AlertDescription>
</Alert>
```

### Loading States
```typescript
// Page-level loading
<div className="space-y-6">
  <Skeleton className="h-20 w-full" />
  <Skeleton className="h-64 w-full" />
  <Skeleton className="h-96 w-full" />
</div>

// Component-level loading
<Skeleton className="h-4 w-32" />

// List loading
<div className="space-y-3">
  <Skeleton className="h-20 w-full" />
  <Skeleton className="h-20 w-full" />
  <Skeleton className="h-20 w-full" />
</div>
```

## 🔌 API Integration

### API Client (`src/lib/api.ts`)

Type-safe API client using TanStack Query for data fetching, caching, and synchronization.

```typescript
// API Client Structure
export const api = {
  // Health & Metrics
  getHealth: () => Promise<HealthResponse>
  getMetrics: () => Promise<MetricsResponse>
  getSystemStatus: () => Promise<SystemStatusResponse>

  // Boards & Sprints
  getBoards: () => Promise<Board[]>
  getSprints: (boardId: string, state?: string) => Promise<Sprint[]>
  getSprint: (sprintId: string) => Promise<SprintDetails>

  // Reports
  generateReport: (options: ReportOptions) => Promise<Report>
  getReports: () => Promise<Report[]>
  getReport: (id: string) => Promise<Report>
  deleteReport: (id: string) => Promise<void>

  // GitHub
  getCommits: (owner: string, repo: string, since?, until?, limit?) => Promise<Commit[]>
  getPullRequests: (owner: string, repo: string, state?, limit?) => Promise<PullRequest[]>

  // Analytics
  getVelocityData: (boardId: string, sprintCount: number) => Promise<VelocityData>
}
```

### Query Patterns

**Real-time Data (with auto-refresh)**
```typescript
const { data: health } = useQuery({
  queryKey: ['health'],
  queryFn: api.getHealth,
  refetchInterval: 30000, // Refresh every 30s
});
```

**Conditional Queries**
```typescript
const { data: commits, isLoading } = useQuery({
  queryKey: ['commits', owner, repo, since, until],
  queryFn: () => api.getCommits(owner, repo, since, until, 50),
  enabled: !!owner && !!repo, // Only fetch when both provided
});
```

**Mutations**
```typescript
const generateReport = useMutation({
  mutationFn: api.generateReport,
  onSuccess: (data) => {
    // Handle success
  },
  onError: (error) => {
    // Handle error
  },
});

// Usage
generateReport.mutate(options);
```

## 📄 Pages

### 1. Dashboard (`Dashboard.tsx`)
**Route**: `/`
**Purpose**: Main landing page with system overview

**Features**:
- System health status (Jira, GitHub, Cache)
- Performance metrics with trends
- Quick action cards (Generate Report, Analytics)
- Recent activity timeline
- Real-time updates (30-second refresh)

**Key Components**:
- System status cards with color-coded health indicators
- Metric cards with trend indicators (increasing/decreasing/stable)
- Activity timeline with icon-based entries
- Quick navigation cards

### 2. Report Generator (`ReportGenerator.tsx`)
**Route**: `/generate`
**Purpose**: Create new sprint reports

**Features**:
- Board selection dropdown
- Sprint selection (closed sprints only)
- GitHub repository integration (optional)
- Report format selection (HTML, Markdown, JSON)
- Template selection (Executive, Detailed, Technical)
- Live preview after generation
- Download in original format + PDF

**Key Components**:
- Multi-step form with validation
- Sprint loading skeleton
- Report preview area
- Download buttons with format indicators

### 3. Report Viewer (`ReportViewer.tsx`)
**Route**: `/report/:reportId`
**Purpose**: View and manage generated reports

**Features**:
- Report metadata display
- Format-specific rendering (HTML/Markdown/JSON)
- Download functionality
- Delete with confirmation
- Error handling with alerts

**Key Components**:
- Report metadata card
- Format-aware content renderer
- Action buttons (Download, Delete)
- Loading skeletons
- Error alerts

### 4. Analytics (`Analytics.tsx`)
**Route**: `/analytics`
**Purpose**: Visual analytics and insights

**Features**:
- Board selection
- Time period filtering
- Sprint velocity trend chart
- Completion rate analysis
- Story points distribution
- Key metrics overview
- PDF export

**Key Components**:
- Interactive charts (Recharts)
- Filter controls
- Metric cards
- Chart loading skeletons

### 5. GitHub Integration (`GitHub.tsx`)
**Route**: `/github`
**Purpose**: GitHub repository analysis

**Features**:
- Owner/repository input
- Date range filtering
- PR state filtering (open/closed/all)
- Commit history display
- Pull request listing
- Direct links to GitHub

**Key Components**:
- Repository configuration form
- Commit cards with author/date
- PR cards with state badges
- Loading skeletons for lists

### 6. Velocity Tracker (`Velocity.tsx`)
**Route**: `/velocity`
**Purpose**: Sprint velocity analysis

**Features**:
- Board selection
- Sprint count configuration (1-10)
- Velocity trend chart
- Average velocity calculation
- Trend indicators
- Sprint-by-sprint breakdown

**Key Components**:
- Velocity configuration controls
- Trend chart
- Metric summary cards
- Sprint detail cards

### 7. MCP Tools Status (`ToolsStatus.tsx`)
**Route**: `/tools`
**Purpose**: Monitor MCP tools health

**Features**:
- Real-time tool status
- Category grouping (Jira, GitHub, Report, Analytics)
- Availability indicators
- Performance metrics
- Refresh button
- Uptime tracking

**Key Components**:
- System health overview
- Tool status grid
- Metric cards
- Status badges

## 🎯 Key Features

### Responsive Design
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Mobile-first**: All components responsive
- **Grid layouts**: Adaptive columns based on screen size

### Accessibility
- **shadcn/ui**: Built on Radix UI primitives (WCAG compliant)
- **Semantic HTML**: Proper heading hierarchy, landmarks
- **Keyboard navigation**: Full keyboard support
- **Screen readers**: ARIA labels and descriptions
- **Focus management**: Visible focus indicators

### Performance
- **Code splitting**: Route-based lazy loading
- **Optimized images**: Proper sizing and formats
- **Query caching**: TanStack Query automatic caching
- **Memoization**: React.memo for expensive components
- **Bundle analysis**: Vite-optimized production builds

### Error Handling
- **Error boundaries**: Page-level error catching
- **Alert components**: User-friendly error messages
- **Retry logic**: Automatic retries with exponential backoff
- **Fallback UI**: Graceful degradation

## 🔧 Configuration

### Tailwind Configuration (`tailwind.config.js`)
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn/ui color system
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { /* ... */ },
        secondary: { /* ... */ },
        destructive: { /* ... */ },
        muted: { /* ... */ },
        accent: { /* ... */ },
        popover: { /* ... */ },
        card: { /* ... */ },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

### Vite Configuration (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## 🚀 Development

### Setup
```bash
cd web
npm install
```

### Development Server
```bash
npm run dev
# Runs on http://localhost:3002
```

### Build
```bash
npm run build
# Output: dist/
```

### Type Checking
```bash
npm run type-check
# Validates TypeScript without emitting files
```

### Linting
```bash
npm run lint
# ESLint with React plugin
```

### Preview Production Build
```bash
npm run preview
# Serves production build locally
```

## 📦 Dependencies

### Production Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2",
  "@tanstack/react-query": "^5.56.2",
  "recharts": "^2.12.7",
  "lucide-react": "^0.446.0",
  "@radix-ui/react-alert-dialog": "^1.1.2",
  "@radix-ui/react-separator": "^1.1.0",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-tabs": "^1.1.1",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.5.3",
  "tailwindcss-animate": "^1.0.7"
}
```

### Development Dependencies
```json
{
  "@types/react": "^18.3.3",
  "@types/react-dom": "^18.3.0",
  "@vitejs/plugin-react": "^4.3.1",
  "autoprefixer": "^10.4.20",
  "postcss": "^8.4.47",
  "tailwindcss": "^3.4.13",
  "typescript": "^5.5.3",
  "vite": "^5.4.2",
  "eslint": "^9.9.0"
}
```

## 🐛 Common Issues

### Issue: shadcn/ui components not found
**Solution**: Check `components.json` configuration and ensure `@/` alias is set up correctly in `tsconfig.json` and `vite.config.ts`.

### Issue: API calls failing with CORS error
**Solution**: Verify API server is running on port 3000 and CORS is configured to allow `localhost:3002`.

### Issue: TanStack Query not refetching
**Solution**: Check `staleTime` and `cacheTime` settings. Use `refetchInterval` for real-time data.

### Issue: Build fails with TypeScript errors
**Solution**: Run `npm run type-check` to identify type errors. Ensure all imports are typed correctly.

## 📊 Performance Metrics

### Lighthouse Scores (Target)
- **Performance**: >90
- **Accessibility**: >95
- **Best Practices**: >95
- **SEO**: >90

### Bundle Size (Production)
- **JavaScript**: ~250KB (gzipped)
- **CSS**: ~15KB (gzipped)
- **Total Initial Load**: <300KB

### Loading Performance
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Time to Interactive (TTI)**: <3.5s
- **Cumulative Layout Shift (CLS)**: <0.1

## 🔄 Recent Changes

### October 2, 2025: shadcn/ui Migration
- ✅ Added 6 new shadcn/ui components (Alert, Badge, Skeleton, Separator, Tabs, Table)
- ✅ Replaced all custom buttons with shadcn Button component (14 instances)
- ✅ Replaced all custom loading spinners with Skeleton component (8 instances)
- ✅ Replaced all custom alerts with Alert component (2 instances)
- ✅ Removed unused imports and fixed TypeScript errors
- ✅ Achieved 100% shadcn/ui coverage for UI components
- ✅ All TypeScript compilation passes with no errors

**Files Modified**: 6 pages (GitHub.tsx, Analytics.tsx, ReportGenerator.tsx, ToolsStatus.tsx, ReportViewer.tsx, Velocity.tsx)
**Components Added**: alert.tsx, badge.tsx, skeleton.tsx, separator.tsx, tabs.tsx, table.tsx
**Build Status**: ✅ Clean (no errors, no warnings)

## 🎓 Best Practices

### Component Organization
```typescript
// 1. Imports (grouped)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

// 2. Types/Interfaces
interface PageProps { /* ... */ }

// 3. Component
export function Page() {
  // 4. Hooks
  const [state, setState] = useState();
  const { data } = useQuery({ /* ... */ });

  // 5. Handlers
  const handleAction = () => { /* ... */ };

  // 6. Render
  return (/* ... */);
}
```

### State Management
- **Local state**: `useState` for component-specific state
- **Server state**: TanStack Query for API data
- **Form state**: Controlled components with validation
- **Global state**: Not needed (server state + local state sufficient)

### Styling Approach
- **Utility-first**: Tailwind CSS classes
- **Component variants**: shadcn/ui variant system
- **Responsive**: Mobile-first breakpoints
- **Consistency**: Design tokens from shadcn/ui theme

### Type Safety
- **Strict mode**: Enabled in TypeScript config
- **API types**: All API responses typed
- **Props**: Interface definitions for all components
- **No implicit any**: Explicit type annotations required

---

**Status**: ✅ Production Ready
**Maintainer**: Development Team
**Last Review**: October 2, 2025
