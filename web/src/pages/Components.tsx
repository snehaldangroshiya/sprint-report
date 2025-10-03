import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FileText, Download, Settings } from 'lucide-react';

export function Components() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Component Library</h1>
        <p className="mt-2 text-muted-foreground">
          shadcn/ui component showcase for NextRelease MCP
        </p>
      </div>

      {/* Button Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Button Component</CardTitle>
          <CardDescription>
            Various button variants and sizes with shadcn/ui styling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">With Icons</h3>
            <div className="flex flex-wrap gap-3">
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">States</h3>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled</Button>
              <Button variant="outline" disabled>
                Disabled Outline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Component */}
      <Card>
        <CardHeader>
          <CardTitle>Card Component</CardTitle>
          <CardDescription>
            Flexible card component for content organization
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Simple Card</CardTitle>
              <CardDescription>
                Basic card with header and content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                This is a simple card demonstrating the basic structure.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Card with Footer</CardTitle>
              <CardDescription>
                Card including footer actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Content area with additional information.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-lg">Highlighted Card</CardTitle>
              <CardDescription>
                Card with custom border styling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Using custom className for styling variations.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Form Components */}
      <Card>
        <CardHeader>
          <CardTitle>Form Components</CardTitle>
          <CardDescription>
            Input and Select components for forms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Input</label>
            <Input placeholder="Enter text..." />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Input with value</label>
            <Input defaultValue="Default value" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Disabled Input</label>
            <Input placeholder="Disabled..." disabled />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select</label>
            <Select defaultValue="">
              <option value="" disabled>
                Choose an option...
              </option>
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
              <option value="3">Option 3</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email Input</label>
            <Input type="email" placeholder="email@example.com" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Number Input</label>
            <Input type="number" placeholder="0" />
          </div>
        </CardContent>
      </Card>

      {/* Real-world Example */}
      <Card>
        <CardHeader>
          <CardTitle>Real-world Example</CardTitle>
          <CardDescription>
            Combined components in a practical form layout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Board</label>
                <Select>
                  <option>SCNT Board</option>
                  <option>Team Board</option>
                  <option>Product Board</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sprint</label>
                <Input placeholder="Sprint name..." />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Report Format</label>
              <Select>
                <option>HTML</option>
                <option>Markdown</option>
                <option>JSON</option>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button type="submit">Generate Report</Button>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
