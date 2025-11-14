# Mobile Responsiveness Fixes - Implementation Guide

This guide provides specific code fixes for all identified mobile responsiveness issues in the NextReleaseMCP web application.

## Table of Contents
1. [Navigation Bar Mobile Menu](#1-navigation-bar-mobile-menu)
2. [Grid Layouts with Responsive Gaps](#2-grid-layouts-with-responsive-gaps)
3. [Charts Mobile Optimization](#3-charts-mobile-optimization)
4. [Dialog Mobile Constraints](#4-dialog-mobile-constraints)
5. [Tables Mobile View](#5-tables-mobile-view)
6. [Text Overflow Prevention](#6-text-overflow-prevention)
7. [Responsive Text Scaling](#7-responsive-text-scaling)
8. [Flex Layout Mobile Direction](#8-flex-layout-mobile-direction)
9. [Pagination Mobile](#9-pagination-mobile)
10. [Badge Wrapping](#10-badge-wrapping)

---

## 1. Navigation Bar Mobile Menu

### Issue
Current navigation shows all text labels inline, causing overflow on mobile.

### Current Code (Layout.tsx, lines 36-54)
```tsx
<nav className="flex items-center gap-1">
  {navigation.map((item) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.name}
        to={item.href}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive(item.href)
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
        {item.name}
      </Link>
    );
  })}
</nav>
```

### Fixed Code - Option A: Icon-Only Mobile
```tsx
<nav className="flex items-center gap-1">
  {navigation.map((item) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.name}
        to={item.href}
        title={item.name}
        className={`inline-flex items-center gap-2 px-2 sm:px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive(item.href)
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
        {/* Hide label on mobile, show on sm+ */}
        <span className="hidden sm:inline">
          {item.name}
        </span>
      </Link>
    );
  })}
</nav>
```

### Fixed Code - Option B: Mobile Drawer Menu
**Install**: `npm install @radix-ui/react-drawer` (or use shadcn dialog)

```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3 },
    { name: 'Analytics', href: '/analytics', icon: Activity },
    { name: 'MCP Tools', href: '/tools', icon: Wrench },
    { name: 'GitHub', href: '/github', icon: GitBranch },
    { name: 'Velocity', href: '/velocity', icon: TrendingUp },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold tracking-tight">
                Sprint Reporter
              </h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive(item.href)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Navigation - Drawer */}
            <Sheet>
              <SheetTrigger asChild className="sm:hidden">
                <button className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px]">
                <nav className="flex flex-col gap-2 mt-8">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          isActive(item.href)
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
```

**Choose Option B** (Drawer) for better mobile UX with proper spacing.

---

## 2. Grid Layouts with Responsive Gaps

### Issue
Grids have fixed gap sizes that are too large on mobile.

### Current Code (Dashboard.tsx, line 125)
```tsx
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
  {/* 4 stat cards */}
</div>
```

### Fixed Code
```tsx
{/* Mobile: 1 col, gap-3
    Tablet (sm): 2 cols, gap-4  
    Desktop (lg): 4 cols, gap-5 */}
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
  {/* 4 stat cards */}
</div>
```

### Apply Pattern to All Grids

**Dashboard.tsx**:
- Line 125: ✓ Apply gap-3 → gap-4 → gap-5
- Line 202: ✓ Apply gap-3 → gap-4 → gap-5
- Line 304: ✓ Apply gap-3 → gap-4 → gap-5
- Line 467: ✓ Apply gap-3 → gap-4 → gap-5

**Analytics.tsx**:
- Line 111: `grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4`
- Line 153: `grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5`
- Line 226: `grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6`

**GitHub.tsx**:
- Line 112: `grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4`
- Line 137: `grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4`

---

## 3. Charts Mobile Optimization

### Issue
Charts have fixed heights and font sizes that don't scale for mobile.

### Current Code (Analytics.tsx, lines 244-253)
```tsx
<ResponsiveContainer width="100%" height={288}>
  <LineChart data={[...velocityData.sprints].reverse()}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis
      dataKey="name"
      tick={{ fontSize: 12 }}
      angle={-45}
      textAnchor="end"
      height={80}
    />
```

### Fixed Code
```tsx
// Add mobile height calculation hook
const getChartHeight = () => {
  if (typeof window === 'undefined') return 288;
  const width = window.innerWidth;
  // Mobile: 240, Tablet: 300, Desktop: 288
  if (width < 640) return 240;
  if (width < 1024) return 300;
  return 320;
};

const chartHeight = getChartHeight();
const chartFontSize = window.innerWidth < 640 ? 10 : 12;
const xAxisHeight = window.innerWidth < 640 ? 60 : 80;
const xAxisAngle = window.innerWidth < 640 ? 0 : -45; // No angle on mobile

<ResponsiveContainer width="100%" height={chartHeight}>
  <LineChart data={[...velocityData.sprints].reverse()}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis
      dataKey="name"
      tick={{ fontSize: chartFontSize }}
      angle={xAxisAngle}
      textAnchor={xAxisAngle === 0 ? 'middle' : 'end'}
      height={xAxisHeight}
    />
    <YAxis tick={{ fontSize: chartFontSize }} />
```

### Better Solution: Use Responsive Wrapper Component
```tsx
// Create new component: src/components/ResponsiveChart.tsx
import { useEffect, useState } from 'react';

interface ResponsiveChartProps {
  children: React.ReactNode;
  minHeight?: number;
}

export function ResponsiveChart({ children, minHeight = 240 }: ResponsiveChartProps) {
  const [dimensions, { width, height }] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: minHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: Math.max(minHeight, window.innerHeight / 2),
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minHeight]);

  const isMobile = width < 640;
  const isTablet = width < 1024;

  return (
    <div style={{ height: isMobile ? 240 : isTablet ? 300 : 320 }}>
      {/* Pass chart config based on size */}
      {React.cloneElement(children as React.ReactElement, {
        fontSize: isMobile ? 10 : 12,
        showXAxisAngle: !isMobile,
      })}
    </div>
  );
}

// Usage:
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>
    <ResponsiveChart>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={velocityData.sprints}>
          {/* chart content */}
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChart>
  </CardContent>
</Card>
```

---

## 4. Dialog Mobile Constraints

### Issue
Dialog width is not constrained on mobile screens.

### Current Code (ConfigurationWidget.tsx, line 225)
```tsx
<DialogContent className="sm:max-w-[600px]">
```

### Fixed Code
```tsx
<DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-lg">
  {/* Dialog automatically scrollable and sized for mobile */}
</DialogContent>
```

### Explanation
- `max-w-[95vw]`: Mobile dialog uses 95% of viewport width (leaves 2.5% margin each side)
- `sm:max-w-[600px]`: Desktop uses fixed 600px width
- `max-h-[90vh]`: Maximum height is 90% viewport height
- `overflow-y-auto`: Content scrolls if too tall
- No horizontal scrolling needed on mobile

---

## 5. Tables Mobile View

### Issue
Tables are unreadable on mobile due to fixed columns.

### Current Code (Analytics.tsx, lines 519-552)
```tsx
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Sprint</TableHead>
        <TableHead className="text-right">Commitment</TableHead>
        <TableHead className="text-right">Completed</TableHead>
        <TableHead className="text-right">Velocity</TableHead>
        <TableHead className="text-right">Success Rate</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {/* rows */}
    </TableBody>
  </Table>
</div>
```

### Fixed Code - Option A: Horizontal Scroll
```tsx
{/* Wrap table in scrollable container */}
<div className="rounded-md border overflow-x-auto">
  <Table className="min-w-full">
    {/* existing table code */}
  </Table>
</div>

{/* Show scroll hint on mobile */}
<p className="text-xs text-muted-foreground mt-2 sm:hidden text-center">
  ← Scroll right to see more
</p>
```

### Fixed Code - Option B: Mobile Card Layout
```tsx
// Use different layout on mobile vs desktop
<div className="hidden sm:block rounded-md border overflow-x-auto">
  {/* Desktop table view */}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Sprint</TableHead>
        <TableHead className="text-right">Commitment</TableHead>
        <TableHead className="text-right">Completed</TableHead>
        <TableHead className="text-right">Velocity</TableHead>
        <TableHead className="text-right">Success Rate</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {[...velocityData.sprints].map((sprint) => (
        <TableRow key={sprint.id}>
          <TableCell className="font-medium">{sprint.name}</TableCell>
          <TableCell className="text-right">{sprint.commitment}</TableCell>
          <TableCell className="text-right">{sprint.completed}</TableCell>
          <TableCell className="text-right font-semibold">{sprint.velocity}</TableCell>
          <TableCell className="text-right">
            <Badge variant={...}>
              {successRate.toFixed(1)}%
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>

{/* Mobile card view */}
<div className="sm:hidden space-y-3">
  {[...velocityData.sprints].map((sprint) => {
    const successRate = sprint.commitment > 0
      ? (sprint.completed / sprint.commitment) * 100
      : 0;

    return (
      <Card key={sprint.id} className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{sprint.name}</h3>
            <Badge variant={successRate >= 80 ? "default" : "secondary"}>
              {successRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Committed</p>
              <p className="font-semibold">{sprint.commitment}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Completed</p>
              <p className="font-semibold">{sprint.completed}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Velocity</p>
              <p className="font-semibold">{sprint.velocity}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  })}
</div>
```

**Recommendation**: Use Option B (Card Layout) for better mobile UX.

---

## 6. Text Overflow Prevention

### Issue
"View Details →" link overflows on mobile.

### Current Code (Dashboard.tsx, line 816)
```tsx
<div className="whitespace-nowrap text-right text-sm">
  <Link to={`/sprint/${sprint.id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
    View Details →
  </Link>
</div>
```

### Fixed Code
```tsx
{/* Remove whitespace-nowrap to allow wrapping */}
<div className="text-right text-sm">
  <Link 
    to={`/sprint/${sprint.id}`} 
    className="text-blue-600 hover:text-blue-800 font-medium hover:underline truncate inline-block max-w-full"
  >
    View Details →
  </Link>
</div>

{/* OR: show icon only on mobile, text on desktop */}
<Link to={`/sprint/${sprint.id}`} className="text-blue-600 hover:text-blue-800">
  <span className="hidden sm:inline font-medium hover:underline">
    View Details →
  </span>
  <span className="sm:hidden inline-block">
    <ArrowRight className="h-4 w-4" />
  </span>
</Link>
```

---

## 7. Responsive Text Scaling

### Issue
Page titles are `text-2xl` or `text-3xl` on all screens.

### Current Code (Dashboard.tsx, line 113)
```tsx
<h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
```

### Fixed Code
```tsx
{/* Scales from 20px on mobile to 28px on desktop */}
<h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
  Dashboard
</h1>

{/* All major headings should follow this pattern */}
{/* Analytics.tsx, line 97 */}
<h1 className="text-xl sm:text-2xl font-bold tracking-tight">
  Sprint Analytics
</h1>

{/* GitHub.tsx, line 94 */}
<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
  GitHub Integration
</h1>

{/* Velocity.tsx, line 46 */}
<h1 className="text-xl sm:text-2xl font-bold text-gray-900">
  Sprint Velocity Analytics
</h1>
```

### Tailwind Text Scale Reference
```
text-xs  = 12px
text-sm  = 14px
text-base = 16px
text-lg  = 18px
text-xl  = 20px
text-2xl = 24px
text-3xl = 30px
text-4xl = 36px
```

---

## 8. Flex Layout Mobile Direction

### Issue
Flex layouts don't stack properly on mobile.

### Current Code (Dashboard.tsx, line 666)
```tsx
<div className="flex items-center justify-between">
  <div>
    <CardTitle>Recent Sprint Activity</CardTitle>
    <CardDescription>Track active and completed sprints</CardDescription>
  </div>
  <div className="flex items-center gap-4">
    {/* Two selects side by side */}
    <Select ...>
    <Select ...>
  </div>
</div>
```

### Fixed Code
```tsx
<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
  <div>
    <CardTitle>Recent Sprint Activity</CardTitle>
    <CardDescription className="text-xs sm:text-sm">
      Track active and completed sprints
    </CardDescription>
  </div>
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
    {/* Stacks vertically on mobile, horizontally on sm+ */}
    <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
      <span className="text-xs sm:text-sm text-gray-600 flex-shrink-0">Filter:</span>
      <Select ...>
        <SelectTrigger className="w-full sm:w-auto min-w-[110px]">
    </div>
    <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
      <span className="text-xs sm:text-sm text-gray-600 flex-shrink-0">Show:</span>
      <Select ...>
        <SelectTrigger className="w-full sm:w-auto min-w-[90px]">
    </div>
  </div>
</div>
```

**Key changes**:
- `flex-col sm:flex-row` - Stack on mobile, row on desktop
- `items-stretch sm:items-center` - Full width on mobile, center on desktop
- `gap-4` → `gap-2 sm:gap-4` - Smaller gaps on mobile
- `w-full sm:w-auto` - Full width buttons on mobile
- `min-w-0` - Prevent flex items from overflowing

---

## 9. Pagination Mobile

### Issue
All pagination buttons visible on mobile, taking too much space.

### Current Code (SprintDetails.tsx)
```tsx
{/* Uses shadcn/ui Pagination which shows 7+ buttons */}
<Pagination>
  <PaginationContent>
    <PaginationPrevious ... />
    <PaginationItem>
      <PaginationLink isActive={...}>{page}</PaginationLink>
    </PaginationItem>
    {/* more items */}
    <PaginationNext ... />
  </PaginationContent>
</Pagination>
```

### Fixed Code - Create Mobile-Friendly Pagination
```tsx
// Create: src/components/ResponsivePagination.tsx
import { Button } from './ui/button';

interface ResponsivePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ResponsivePagination({
  currentPage,
  totalPages,
  onPageChange,
}: ResponsivePaginationProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
      {/* Previous button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="text-xs sm:text-sm px-2 sm:px-3"
      >
        ← Prev
      </Button>

      {/* Mobile: show current page only */}
      <div className="sm:hidden px-2 py-1 text-xs font-medium">
        {currentPage} / {totalPages}
      </div>

      {/* Desktop: show page numbers */}
      <div className="hidden sm:flex gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
            className="text-xs h-8 w-8 p-0"
          >
            {page}
          </Button>
        ))}
      </div>

      {/* Next button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="text-xs sm:text-sm px-2 sm:px-3"
      >
        Next →
      </Button>
    </div>
  );
}
```

---

## 10. Badge Wrapping

### Issue
Multiple badges in a row don't wrap on mobile, causing overflow.

### Current Code (IssueCard.tsx, lines 75-92)
```tsx
<div className="flex items-center gap-2 mb-2">
  <Badge variant="outline" className="text-xs">
    {issue.key}
  </Badge>
  <Badge variant="secondary" className="text-xs">
    {issue.issueType}
  </Badge>
  {issue.storyPoints && (
    <Badge variant="default" className={`text-xs ${config.storyPointsColor}`}>
      {issue.storyPoints} SP
    </Badge>
  )}
</div>
```

### Fixed Code
```tsx
<div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
  <Badge variant="outline" className="text-xs">
    {issue.key}
  </Badge>
  <Badge variant="secondary" className="text-xs">
    {issue.issueType}
  </Badge>
  {issue.storyPoints && (
    <Badge variant="default" className={`text-xs ${config.storyPointsColor}`}>
      {issue.storyPoints} SP
    </Badge>
  )}
</div>
```

**Key changes**:
- Add `flex-wrap` to allow badges to wrap to next line
- `gap-1 sm:gap-2` - Tighter gap on mobile, normal on desktop
- Badges automatically wrap as needed

### Apply Pattern to All Badge Groups
- ConfigurationWidget.tsx (line 132)
- GitHub.tsx (line 225)
- Dashboard.tsx (multiple card headers)
- Analytics.tsx (multiple sections)

---

## Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. ✓ Navigation bar mobile menu
2. ✓ Dialog mobile constraints
3. ✓ Grid gap responsiveness
4. ✓ Text overflow prevention

### Phase 2: UX Improvements (Week 2)
5. ✓ Charts mobile height
6. ✓ Tables mobile view
7. ✓ Responsive text scaling
8. ✓ Flex layout stacking

### Phase 3: Polish (Week 3)
9. ✓ Pagination mobile
10. ✓ Badge wrapping
11. ✓ Touch targets (44px minimum)
12. ✓ Testing across devices

---

## Testing Strategy

### Breakpoints to Test
- **320px** (iPhone SE) - Extra small phones
- **375px** (iPhone 12) - Standard phones
- **425px** (iPhone 12 Pro Max) - Large phones
- **768px** (iPad) - Tablets
- **1024px** (iPad Pro) - Large tablets
- **1440px** (Desktop) - Standard desktop

### Manual Testing Checklist
```
Navigation:
- [ ] Menu appears at sm breakpoint
- [ ] Navigation items don't overflow
- [ ] Touch targets are 44px+

Layouts:
- [ ] Grids stack properly at each breakpoint
- [ ] Gaps are proportional to screen size
- [ ] Content stays readable

Charts:
- [ ] Charts fit within viewport
- [ ] Axis labels don't overlap
- [ ] Legend is readable

Dialogs:
- [ ] Dialog width constrained to viewport
- [ ] Content scrollable on mobile
- [ ] Close button accessible

Tables:
- [ ] Table scrollable horizontally OR card view on mobile
- [ ] All data visible
- [ ] Touch-friendly interaction

Forms:
- [ ] Inputs full width on mobile
- [ ] Labels above inputs on mobile
- [ ] Submit buttons full width

General:
- [ ] No horizontal scrolling (except tables)
- [ ] All text readable (no truncation except intentional)
- [ ] Touch interactions work on actual devices
- [ ] 200% zoom doesn't break layout
```

---

## Browser DevTools Testing

### Chrome/Edge DevTools
1. Press F12
2. Click Device Toolbar icon (Ctrl+Shift+M)
3. Select device from dropdown:
   - iPhone SE
   - iPhone 12
   - iPhone 12 Pro Max
   - iPad
4. Test interactions at each size

### Firefox DevTools
1. Press F12
2. Click Responsive Design Mode (Ctrl+Shift+M)
3. Manually enter widths: 320, 375, 425, 768, 1024

---

## Resources

### Tailwind Responsive Classes
- https://tailwindcss.com/docs/responsive-design

### Shadcn/ui Mobile Patterns
- https://ui.shadcn.com/docs/responsive

### Mobile Best Practices
- https://web.dev/responsive-web-design-basics/
- https://developers.google.com/web/fundamentals/design-and-ux/responsive

