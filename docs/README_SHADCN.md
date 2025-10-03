# shadcn/ui Component Architecture

## Overview

NextRelease MCP now includes **shadcn/ui** component architecture - a collection of beautifully designed, accessible, and customizable React components built with Radix UI and Tailwind CSS.

## Architecture

### 📁 Directory Structure

```
web/
├── src/
│   ├── components/
│   │   └── ui/              # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── select.tsx
│   ├── lib/
│   │   └── utils.ts         # Utility functions (cn helper)
│   ├── pages/
│   │   └── Components.tsx   # Component showcase
│   └── index.css            # CSS variables & Tailwind config
├── components.json          # shadcn/ui configuration
└── tailwind.config.js       # Enhanced Tailwind config
```

### 🎨 Design System

**Color Variables** (Light/Dark mode):
- `--background` / `--foreground`
- `--card` / `--card-foreground`
- `--primary` / `--primary-foreground`
- `--secondary` / `--secondary-foreground`
- `--muted` / `--muted-foreground`
- `--accent` / `--accent-foreground`
- `--destructive` / `--destructive-foreground`
- `--border` / `--input` / `--ring`

**Border Radius**:
- `--radius: 0.5rem` (default)
- `--radius-sm`, `--radius-md`, `--radius-lg`

## Components

### Button

Versatile button component with multiple variants and sizes.

**Variants**: `default` | `secondary` | `destructive` | `outline` | `ghost` | `link`
**Sizes**: `default` | `sm` | `lg` | `icon`

```tsx
import { Button } from '@/components/ui/button';

// Default button
<Button>Click me</Button>

// Variants
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// With icons
<Button>
  <Download className="mr-2 h-4 w-4" />
  Download
</Button>

// As child (polymorphic)
<Button asChild>
  <Link to="/page">Navigate</Link>
</Button>
```

### Card

Container component for organizing content.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Input

Text input component with proper styling and accessibility.

```tsx
import { Input } from '@/components/ui/input';

<Input type="text" placeholder="Enter text..." />
<Input type="email" placeholder="email@example.com" />
<Input type="number" placeholder="0" />
<Input disabled placeholder="Disabled..." />
```

### Select

Native select dropdown with consistent styling.

```tsx
import { Select } from '@/components/ui/select';

<Select defaultValue="1">
  <option value="" disabled>Choose option...</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</Select>
```

## Utilities

### cn() Helper

Merges className strings using `clsx` for conditional classes.

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  anotherCondition ? "true-classes" : "false-classes"
)} />
```

## Configuration

### components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### Tailwind Configuration

Enhanced `tailwind.config.js` includes:
- Dark mode support via `class` strategy
- CSS variables for theming
- Custom color palette using HSL values
- Container utilities
- Animation keyframes
- `tailwindcss-animate` plugin

### TypeScript Paths

`tsconfig.json` configured with:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Dependencies

**Runtime**:
- `@radix-ui/react-slot` - Polymorphic component rendering
- `class-variance-authority` - Variant-based className management
- `clsx` - Conditional className merging

**DevDependencies**:
- `tailwindcss-animate` - Animation utilities
- `tailwindcss` - Utility-first CSS framework
- `autoprefixer` & `postcss` - CSS processing

## Usage Examples

### Form Layout

```tsx
<Card>
  <CardHeader>
    <CardTitle>User Settings</CardTitle>
  </CardHeader>
  <CardContent>
    <form className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <Input placeholder="John Doe" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Role</label>
        <Select>
          <option>Admin</option>
          <option>User</option>
        </Select>
      </div>
      <div className="flex gap-3">
        <Button type="submit">Save</Button>
        <Button variant="outline" type="button">Cancel</Button>
      </div>
    </form>
  </CardContent>
</Card>
```

### Dashboard Stats Card

```tsx
<Card className="border-l-4 border-primary">
  <CardHeader>
    <CardTitle className="text-lg">Total Users</CardTitle>
    <CardDescription>Active users this month</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">1,234</p>
    <p className="text-sm text-muted-foreground">+12% from last month</p>
  </CardContent>
</Card>
```

### Action Bar

```tsx
<div className="flex items-center gap-3">
  <Button>
    <Download className="mr-2 h-4 w-4" />
    Export
  </Button>
  <Button variant="outline">
    <Settings className="mr-2 h-4 w-4" />
    Settings
  </Button>
  <Button variant="ghost" size="icon">
    <MoreVertical className="h-4 w-4" />
  </Button>
</div>
```

## Dark Mode

Dark mode is supported via the `dark` class on the root element:

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark')

// Set dark mode
document.documentElement.classList.add('dark')

// Set light mode
document.documentElement.classList.remove('dark')
```

## Component Showcase

View all components in action at: **http://localhost:3002/components**

The showcase demonstrates:
- All button variants and sizes
- Card layouts and compositions
- Form inputs and selects
- Real-world usage examples

## Best Practices

1. **Use CSS Variables** - Customize theme via CSS variables in `index.css`
2. **Leverage Variants** - Use CVA for component variants instead of conditional classNames
3. **Compose Components** - Build complex UIs by composing simpler components
4. **Follow Patterns** - Match existing component patterns for consistency
5. **Type Safety** - Extend component props with TypeScript interfaces
6. **Accessibility** - Radix UI provides ARIA attributes automatically

## Adding New Components

To add more shadcn/ui components:

1. **Create component file** in `src/components/ui/`
2. **Follow existing patterns** (use cn(), forwardRef, displayName)
3. **Export from index** if creating a component library index
4. **Document usage** in this README
5. **Add to showcase** at `/components` route

## Migration Guide

### From Plain Tailwind

```tsx
// Before
<button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
  Click me
</button>

// After
<Button>Click me</Button>
```

### From Styled Components

```tsx
// Before
const StyledCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
`;

// After
<Card>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [CVA Documentation](https://cva.style)

## Troubleshooting

**Issue**: TypeScript path alias `@/` not resolving
**Fix**: Ensure `tsconfig.json` has correct `baseUrl` and `paths` config

**Issue**: CSS variables not applying
**Fix**: Check `index.css` has `@layer base` definitions loaded

**Issue**: Dark mode not working
**Fix**: Verify `dark` class on `<html>` element and CSS variables defined

**Issue**: Components not styled
**Fix**: Ensure Tailwind processes `src/**/*.{js,ts,jsx,tsx}` files
