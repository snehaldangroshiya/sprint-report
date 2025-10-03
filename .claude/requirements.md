# Jira-GitHub Sprint Reporting MCP Server Requirements

## Project Overview

### Objective
Develop a TypeScript-based MCP (Model Context Protocol) server that integrates Jira and GitHub APIs to generate comprehensive, interactive sprint reports using shadcn/ui components with HTML export capabilities.

### Key Features
- **Bi-directional Integration**: Seamlessly connect Jira sprint data with GitHub development activity
- **Professional UI**: Leverage shadcn/ui components for modern, responsive dashboard design
- **Interactive Reports**: Create dynamic, filterable sprint reports with charts and metrics
- **Multiple Export Formats**: Generate standalone HTML, PDF, and JSON exports
- **Real-time Analytics**: Calculate velocity, burndown, code quality, and team performance metrics

### Target Users
- Scrum Masters and Project Managers
- Development Team Leads
- Product Owners
- Engineering Managers

## Technical Requirements

### Core Technology Stack
- **Runtime**: Node.js 18+ with TypeScript 5+
- **MCP Framework**: @modelcontextprotocol/sdk
- **UI Library**: shadcn/ui with Tailwind CSS
- **Charts**: Recharts for data visualization
- **Export Engine**: React SSR + Puppeteer for PDF generation
- **API Clients**: Axios with retry logic and rate limiting

### Authentication
- **Jira**: Personal Access Token (PAT) or API Token
- **GitHub**: Personal Access Token with repo and PR access scopes
- **Security**: `.env` file-based credential management with validation

## Architecture & Design Patterns

### Layer Architecture
```
┌─ Presentation Layer (shadcn/ui Components & MCP Tools)
├─ Application Layer (Services & Business Logic)
├─ Domain Layer (Entities & Value Objects)
├─ Infrastructure Layer (API Clients & Data Access)
└─ Configuration Layer (Environment & Settings)
```

### Design Pattern Implementation

#### 1. Repository Pattern (Data Access Layer)
```typescript
interface IJiraRepository {
  getSprintData(sprintId: string): Promise<SprintData>;
  getSprintIssues(sprintId: string, fields?: string[]): Promise<Issue[]>;
  searchIssues(jql: string, maxResults?: number): Promise<Issue[]>;
  getBoardConfiguration(boardId: string): Promise<BoardConfig>;
}

interface IGitHubRepository {
  getRepository(owner: string, repo: string): Promise<Repository>;
  getCommits(owner: string, repo: string, options: CommitOptions): Promise<Commit[]>;
  getPullRequests(owner: string, repo: string, options: PROptions): Promise<PullRequest[]>;
  getPRReviews(owner: string, repo: string, prNumber: number): Promise<Review[]>;
  searchCommits(owner: string, repo: string, query: string): Promise<Commit[]>;
}
```

#### 2. Factory Pattern (Report Generation)
```typescript
interface IReportFactory {
  createSprintReport(type: ReportType, config: ReportConfig): ISprintReport;
}

class SprintReportFactory implements IReportFactory {
  createSprintReport(type: 'detailed' | 'summary' | 'executive', config: ReportConfig): ISprintReport {
    switch (type) {
      case 'detailed': return new DetailedSprintReport(config);
      case 'summary': return new SummarySprintReport(config);
      case 'executive': return new ExecutiveSprintReport(config);
      default: throw new Error(`Unsupported report type: ${type}`);
    }
  }
}
```

#### 3. Strategy Pattern (Export Formats)
```typescript
interface IExportStrategy {
  export(reportData: ReportData, options: ExportOptions): Promise<ExportResult>;
}

class HTMLExportStrategy implements IExportStrategy {
  async export(reportData: ReportData, options: ExportOptions): Promise<ExportResult> {
    // React SSR + embedded styling implementation
  }
}

class PDFExportStrategy implements IExportStrategy {
  async export(reportData: ReportData, options: ExportOptions): Promise<ExportResult> {
    // Puppeteer PDF generation implementation
  }
}

class JSONExportStrategy implements IExportStrategy {
  async export(reportData: ReportData, options: ExportOptions): Promise<ExportResult> {
    // Structured JSON export implementation
  }
}
```

#### 4. Observer Pattern (Progress Tracking)
```typescript
interface IProgressObserver {
  onProgress(step: string, percentage: number, message?: string): void;
  onError(error: Error, step: string): void;
  onComplete(result: any): void;
}

class ReportGenerationService {
  private observers: IProgressObserver[] = [];

  addObserver(observer: IProgressObserver): void;
  removeObserver(observer: IProgressObserver): void;
  notifyProgress(step: string, percentage: number, message?: string): void;
  notifyError(error: Error, step: string): void;
  notifyComplete(result: any): void;
}
```

#### 5. Builder Pattern (Report Configuration)
```typescript
class ReportConfigBuilder {
  private config: Partial<ReportConfig> = {};

  setSprintId(sprintId: string): ReportConfigBuilder;
  setGitHubRepositories(repos: string[]): ReportConfigBuilder;
  includeVelocityChart(include: boolean = true): ReportConfigBuilder;
  includeBurndownChart(include: boolean = true): ReportConfigBuilder;
  includeCodeMetrics(include: boolean = true): ReportConfigBuilder;
  setTimeRange(start: Date, end: Date): ReportConfigBuilder;
  setTemplate(template: ReportTemplate): ReportConfigBuilder;
  build(): ReportConfig;
}
```

## MCP Tools Specification

### Jira Integration Tools

#### 1. `jira_get_sprints`
**Purpose**: Fetch active/completed sprints for a board
**Parameters**:
- `board_id` (string): Jira board ID
- `state` (string): Sprint state filter - active/closed/future
**Returns**: Sprint metadata, dates, goals

```typescript
{
  name: "jira_get_sprints",
  description: "Retrieve sprints for a specific Jira board",
  inputSchema: {
    type: "object",
    properties: {
      board_id: { type: "string", description: "Jira board ID" },
      state: {
        type: "string",
        enum: ["active", "closed", "future"],
        description: "Sprint state filter",
        default: "active"
      }
    },
    required: ["board_id"]
  }
}
```

#### 2. `jira_get_sprint_issues`
**Purpose**: Get all issues in a specific sprint
**Parameters**:
- `sprint_id` (string): Sprint ID
- `fields` (array, optional): Specific fields to retrieve
**Returns**: Issue details, status, assignee, story points

```typescript
{
  name: "jira_get_sprint_issues",
  description: "Fetch all issues within a sprint including status, assignee, story points",
  inputSchema: {
    type: "object",
    properties: {
      sprint_id: { type: "string", description: "Sprint ID" },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Specific fields to retrieve",
        default: ["summary", "status", "assignee", "storyPoints", "priority", "issueType"]
      }
    },
    required: ["sprint_id"]
  }
}
```

#### 3. `jira_get_issue_details`
**Purpose**: Fetch detailed information for specific issues
**Parameters**:
- `issue_key` (string): Jira issue key (e.g., PROJ-123)
- `expand` (array): Additional data to expand (changelog, comments)
**Returns**: Full issue data including transitions, comments

```typescript
{
  name: "jira_get_issue_details",
  description: "Get detailed issue information including transitions and comments",
  inputSchema: {
    type: "object",
    properties: {
      issue_key: { type: "string", description: "Jira issue key (e.g., PROJ-123)" },
      expand: {
        type: "array",
        items: { type: "string" },
        description: "Data to expand",
        default: ["changelog", "comments"]
      }
    },
    required: ["issue_key"]
  }
}
```

#### 4. `jira_get_board_configuration`
**Purpose**: Get board settings and workflow configuration
**Parameters**:
- `board_id` (string): Jira board ID
**Returns**: Columns, swimlanes, quick filters

```typescript
{
  name: "jira_get_board_configuration",
  description: "Get board columns, swimlanes, and configuration",
  inputSchema: {
    type: "object",
    properties: {
      board_id: { type: "string", description: "Jira board ID" }
    },
    required: ["board_id"]
  }
}
```

#### 5. `jira_search_issues`
**Purpose**: Advanced JQL search for issues
**Parameters**:
- `jql` (string): JQL query string
- `fields` (array): Fields to include in response
- `max_results` (number): Maximum results to return
**Returns**: Issue list matching search criteria

```typescript
{
  name: "jira_search_issues",
  description: "Search issues using JQL with flexible criteria",
  inputSchema: {
    type: "object",
    properties: {
      jql: { type: "string", description: "JQL query string" },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Fields to include in response"
      },
      max_results: { type: "number", default: 100 }
    },
    required: ["jql"]
  }
}
```

### GitHub Integration Tools

#### 6. `github_get_repository_info`
**Purpose**: Fetch repository metadata and statistics
**Parameters**:
- `owner` (string): Repository owner
- `repo` (string): Repository name
**Returns**: Repo details, contributors, activity metrics

```typescript
{
  name: "github_get_repository_info",
  description: "Get repository details, contributors, and activity metrics",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" }
    },
    required: ["owner", "repo"]
  }
}
```

#### 7. `github_get_commits`
**Purpose**: Retrieve commits for a date range
**Parameters**:
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `since` (string): Start date (ISO 8601)
- `until` (string): End date (ISO 8601)
- `author` (string): Filter by author
**Returns**: Commit history with messages, authors, changes

```typescript
{
  name: "github_get_commits",
  description: "Fetch commit history with messages, authors, and file changes",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" },
      since: { type: "string", format: "date-time", description: "Start date (ISO 8601)" },
      until: { type: "string", format: "date-time", description: "End date (ISO 8601)" },
      author: { type: "string", description: "Filter by author" }
    },
    required: ["owner", "repo"]
  }
}
```

#### 8. `github_get_pull_requests`
**Purpose**: Fetch PRs created/merged in sprint period
**Parameters**:
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `state` (string): PR state - open/closed/all
- `since` (string): Start date
- `until` (string): End date
**Returns**: PR details, reviews, merge status

```typescript
{
  name: "github_get_pull_requests",
  description: "Get pull requests with review status and merge information",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" },
      state: {
        type: "string",
        enum: ["open", "closed", "all"],
        default: "all"
      },
      since: { type: "string", format: "date-time" },
      until: { type: "string", format: "date-time" }
    },
    required: ["owner", "repo"]
  }
}
```

#### 9. `github_get_pr_reviews`
**Purpose**: Get review details for specific PRs
**Parameters**:
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `pr_number` (number): Pull request number
**Returns**: Review comments, approvals, changes requested

```typescript
{
  name: "github_get_pr_reviews",
  description: "Fetch review comments, approvals, and change requests",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" },
      pr_number: { type: "number", description: "Pull request number" }
    },
    required: ["owner", "repo", "pr_number"]
  }
}
```

#### 10. `github_search_commits_by_message`
**Purpose**: Find commits referencing Jira issues
**Parameters**:
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `query` (string): Search query (e.g., issue key pattern)
- `since` (string): Start date
- `until` (string): End date
**Returns**: Commits with issue references

```typescript
{
  name: "github_search_commits_by_message",
  description: "Search commits by message content to find Jira issue references",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" },
      query: { type: "string", description: "Search query (e.g., issue key pattern)" },
      since: { type: "string", format: "date-time" },
      until: { type: "string", format: "date-time" }
    },
    required: ["owner", "repo", "query"]
  }
}
```

### Data Correlation Tools

#### 11. `correlate_issues_with_commits`
**Purpose**: Link Jira issues to GitHub commits via issue keys
**Parameters**:
- `sprint_id` (string): Sprint ID to analyze
- `github_repos` (array): GitHub repositories to search
**Returns**: Mapping of issues to related commits/PRs

```typescript
{
  name: "correlate_issues_with_commits",
  description: "Map Jira issues to related GitHub commits and pull requests",
  inputSchema: {
    type: "object",
    properties: {
      sprint_id: { type: "string", description: "Sprint ID to analyze" },
      github_repos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" }
          }
        },
        description: "GitHub repositories to search"
      }
    },
    required: ["sprint_id", "github_repos"]
  }
}
```

#### 12. `calculate_sprint_metrics`
**Purpose**: Compute velocity, burndown, and completion metrics
**Parameters**:
- `sprint_id` (string): Sprint ID
- `include_github_data` (boolean): Include GitHub activity data
**Returns**: Sprint statistics and performance indicators

```typescript
{
  name: "calculate_sprint_metrics",
  description: "Generate comprehensive sprint performance analytics",
  inputSchema: {
    type: "object",
    properties: {
      sprint_id: { type: "string", description: "Sprint ID" },
      include_github_data: { type: "boolean", default: true }
    },
    required: ["sprint_id"]
  }
}
```

#### 13. `analyze_code_quality_metrics`
**Purpose**: Assess PR review coverage and code changes
**Parameters**:
- `sprint_id` (string): Sprint ID
- `github_repos` (array): GitHub repositories to analyze
**Returns**: Quality metrics, review patterns

```typescript
{
  name: "analyze_code_quality_metrics",
  description: "Calculate code quality metrics including review coverage, change frequency",
  inputSchema: {
    type: "object",
    properties: {
      sprint_id: { type: "string", description: "Sprint ID" },
      github_repos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" }
          }
        }
      }
    },
    required: ["sprint_id", "github_repos"]
  }
}
```

### Report Generation Tools

#### 14. `generate_sprint_summary`
**Purpose**: Create comprehensive sprint overview
**Parameters**:
- `sprint_id` (string): Sprint ID
- `github_repos` (array): GitHub repositories to include
- `include_charts` (boolean): Include chart data
**Returns**: Structured summary data for reporting

```typescript
{
  name: "generate_sprint_summary",
  description: "Compile complete sprint data for report generation",
  inputSchema: {
    type: "object",
    properties: {
      sprint_id: { type: "string", description: "Sprint ID" },
      github_repos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" }
          }
        }
      },
      include_charts: { type: "boolean", default: true }
    },
    required: ["sprint_id"]
  }
}
```

#### 15. `export_sprint_report_html`
**Purpose**: Generate interactive HTML report
**Parameters**:
- `sprint_data` (object): Sprint data from generate_sprint_summary
- `template_options` (object): Template and styling options
- `output_path` (string): Output file path
**Returns**: HTML file path and embedded analytics

```typescript
{
  name: "export_sprint_report_html",
  description: "Create standalone HTML report with embedded styling and interactivity",
  inputSchema: {
    type: "object",
    properties: {
      sprint_data: {
        type: "object",
        description: "Complete sprint data from generate_sprint_summary"
      },
      template_options: {
        type: "object",
        properties: {
          theme: { type: "string", enum: ["light", "dark"], default: "light" },
          include_interactivity: { type: "boolean", default: true },
          embed_assets: { type: "boolean", default: true }
        }
      },
      output_path: {
        type: "string",
        description: "Output file path",
        default: "./sprint-reports"
      }
    },
    required: ["sprint_data"]
  }
}
```

## shadcn/ui Component Architecture

### Main Report Layout
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export function SprintReportDashboard({ sprintData }: { sprintData: SprintData }) {
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Sprint Overview Header */}
      <SprintOverviewCard sprint={sprintData.sprint} metrics={sprintData.metrics} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="code">Code Activity</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Completed Stories" value={sprintData.metrics.completedStories} />
            <MetricCard title="Story Points" value={sprintData.metrics.completedPoints} />
            <MetricCard title="Velocity" value={sprintData.metrics.velocity} />
            <MetricCard title="Code Reviews" value={sprintData.codeMetrics.reviewsConducted} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BurndownChart data={sprintData.charts.burndown} />
            <VelocityChart data={sprintData.charts.velocity} />
          </div>
        </TabsContent>

        <TabsContent value="issues">
          <IssuesDataTable issues={sprintData.issues} />
        </TabsContent>

        <TabsContent value="metrics">
          <div className="space-y-6">
            <CodeQualityMetrics metrics={sprintData.codeMetrics} />
            <TeamPerformanceChart data={sprintData.teamMetrics} />
          </div>
        </TabsContent>

        <TabsContent value="code">
          <CodeActivityTimeline activities={sprintData.codeActivities} />
        </TabsContent>

        <TabsContent value="team">
          <TeamMembersGrid members={sprintData.teamMembers} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Component Specifications

#### Sprint Overview Card
```tsx
function SprintOverviewCard({ sprint, metrics }: SprintOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{sprint.name}</CardTitle>
            <p className="text-muted-foreground">
              {format(sprint.startDate, 'MMM dd')} - {format(sprint.endDate, 'MMM dd, yyyy')}
            </p>
          </div>
          <Badge variant={sprint.state === 'ACTIVE' ? 'default' : 'secondary'}>
            {sprint.state}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span>Sprint Progress</span>
              <span>{metrics.completionPercentage}%</span>
            </div>
            <Progress value={metrics.completionPercentage} className="mt-2" />
          </div>
          {sprint.goal && (
            <div>
              <h4 className="font-medium mb-2">Sprint Goal</h4>
              <p className="text-sm text-muted-foreground">{sprint.goal}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Issues Data Table
```tsx
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const issueColumns = [
  {
    accessorKey: "key",
    header: "Issue",
    cell: ({ row }) => (
      <Button variant="link" className="p-0 h-auto">
        {row.getValue("key")}
      </Button>
    ),
  },
  {
    accessorKey: "summary",
    header: "Summary",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("status")}</Badge>
    ),
  },
  {
    accessorKey: "assignee",
    header: "Assignee",
  },
  {
    accessorKey: "storyPoints",
    header: "Points",
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => (
      <Badge variant={getPriorityVariant(row.getValue("priority"))}>
        {row.getValue("priority")}
      </Badge>
    ),
  },
]

function IssuesDataTable({ issues }: { issues: Issue[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sprint Issues</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable columns={issueColumns} data={issues} />
      </CardContent>
    </Card>
  )
}
```

#### Burndown Chart
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function BurndownChart({ data }: { data: BurndownData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sprint Burndown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="idealBurndown"
              stroke="#8884d8"
              strokeDasharray="5 5"
              name="Ideal"
            />
            <Line
              type="monotone"
              dataKey="actualBurndown"
              stroke="#82ca9d"
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

#### Code Activity Timeline
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function CodeActivityTimeline({ activities }: { activities: CodeActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Code Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={activities}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="commits" fill="#8884d8" name="Commits" />
            <Bar dataKey="prs" fill="#82ca9d" name="Pull Requests" />
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-2">
          {activities.slice(0, 10).map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{activity.type}</Badge>
                <span className="text-sm">{activity.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(activity.timestamp, 'MMM dd, HH:mm')}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

## HTML Export Implementation

### React SSR Export Strategy
```typescript
import { renderToString } from 'react-dom/server'
import { SprintReportDashboard } from './components/SprintReportDashboard'

class HTMLExportService {
  async exportSprintReport(sprintData: SprintData, options: ExportOptions): Promise<string> {
    // 1. Render React components to string
    const reactHTML = renderToString(<SprintReportDashboard sprintData={sprintData} />)

    // 2. Generate complete HTML document
    const completeHTML = this.generateHTMLDocument(reactHTML, options)

    // 3. Inline CSS and assets
    const finalHTML = await this.inlineAssets(completeHTML, options)

    return finalHTML
  }

  private generateHTMLDocument(content: string, options: ExportOptions): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Report - ${options.sprintName}</title>
  ${this.generateEmbeddedCSS(options)}
  ${this.generateChartLibraries()}
</head>
<body>
  <div id="root">${content}</div>
  ${this.generateInteractivityScripts(options)}
</body>
</html>
    `
  }

  private generateEmbeddedCSS(options: ExportOptions): string {
    // Embed Tailwind CSS with only used classes
    // Include shadcn/ui component styles
    // Add custom theme variables
  }

  private generateInteractivityScripts(options: ExportOptions): string {
    if (!options.includeInteractivity) return ''

    // Include minimal React for hydration
    // Chart.js for interactive charts
    // Custom event handlers
  }
}
```

### PDF Export with Puppeteer
```typescript
import puppeteer from 'puppeteer'

class PDFExportService {
  async exportToPDF(htmlContent: string, options: PDFOptions): Promise<Buffer> {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1in',
        bottom: '1in',
        left: '0.5in',
        right: '0.5in'
      },
      ...options
    })

    await browser.close()
    return pdfBuffer
  }
}
```

## Environment Configuration

### .env File Setup
Create a `.env` file in the project root with the following variables:

```bash
# Jira Configuration
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_API_TOKEN=your_jira_api_token
JIRA_EMAIL=your_email@company.com

# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_API_URL=https://api.github.com

# MCP Server Configuration
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost

# Report Configuration
REPORT_OUTPUT_DIR=./sprint-reports
REPORT_TEMPLATE_DIR=./templates
REPORT_CACHE_TTL=3600

# Export Configuration
PDF_EXPORT_TIMEOUT=30000
HTML_ASSET_INLINE=true
CHART_LIBRARY=recharts

# Development/Debug
NODE_ENV=production
LOG_LEVEL=info
ENABLE_API_LOGGING=false
```

**Note**: Add `.env` to your `.gitignore` file to prevent committing sensitive credentials.

### Environment Loading & Validation
```typescript
import { z } from 'zod'
import * as dotenv from 'dotenv'

// Load .env file
dotenv.config()

const ConfigSchema = z.object({
  jira: z.object({
    baseUrl: z.string().url(),
    apiToken: z.string().min(1),
    email: z.string().email()
  }),
  github: z.object({
    token: z.string().min(1),
    apiUrl: z.string().url().default('https://api.github.com')
  }),
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost')
  }),
  reports: z.object({
    outputDir: z.string().default('./sprint-reports'),
    templateDir: z.string().default('./templates'),
    cacheTtl: z.number().default(3600)
  })
})

export type Config = z.infer<typeof ConfigSchema>

export function validateConfig(): Config {
  return ConfigSchema.parse({
    jira: {
      baseUrl: process.env.JIRA_BASE_URL,
      apiToken: process.env.JIRA_API_TOKEN,
      email: process.env.JIRA_EMAIL
    },
    github: {
      token: process.env.GITHUB_TOKEN,
      apiUrl: process.env.GITHUB_API_URL
    },
    server: {
      port: parseInt(process.env.MCP_SERVER_PORT || '3000'),
      host: process.env.MCP_SERVER_HOST
    },
    reports: {
      outputDir: process.env.REPORT_OUTPUT_DIR,
      templateDir: process.env.REPORT_TEMPLATE_DIR,
      cacheTtl: parseInt(process.env.REPORT_CACHE_TTL || '3600')
    }
  })
}
```

## Implementation Phases (Revised Timeline: 28 Days)

### Phase 1: Foundation & Infrastructure (Days 1-4)
**Deliverables:**
- Project setup with TypeScript, MCP SDK, and dependencies
- Development tooling (ESLint, Prettier, Husky)
- Core architecture implementation with design patterns
- `.env` file configuration and validation system
- Error handling, caching, and rate limiting infrastructure
- Basic logging and monitoring setup

**Key Tasks:**
- Initialize TypeScript project with comprehensive tooling
- Set up `.env` file configuration with dotenv and validation
- Implement error handling, caching, and rate limiting classes
- Create base MCP server structure with health checks
- Set up Redis connection and cache management
- Implement Repository pattern foundation
- Create comprehensive logging system

### Phase 2: Core API Integration (Days 5-11)
**Deliverables:**
- All 15 MCP tools implemented with comprehensive error handling
- Data correlation engine for linking Jira issues to GitHub activity
- Metrics calculation services with caching
- Comprehensive API testing with mock responses
- Rate limiting and circuit breaker implementation

**Key Tasks:**
- Implement all Jira integration tools (1-5) with error handling
- Implement all GitHub integration tools (6-10) with rate limiting
- Build data correlation and analytics tools (11-13)
- Create metrics calculation engine with caching
- Add comprehensive unit and integration testing
- Implement API mocking for development and testing

### Phase 3: Basic Reporting & UI (Days 12-17)
**Deliverables:**
- Simplified report generation (JSON/HTML templates instead of full React SSR)
- Basic shadcn/ui components for essential functionality
- Simple dashboard with core metrics
- Template-based HTML export with embedded styling

**Key Tasks:**
- Create template-based reporting system
- Implement core shadcn/ui components (tables, cards, charts)
- Build basic dashboard with essential metrics
- Create HTML template export system
- Implement basic PDF generation
- Add component testing

### Phase 4: Advanced Features & Export (Days 18-22)
**Deliverables:**
- Interactive dashboard with advanced charts
- Multiple export formats (HTML, PDF, JSON)
- Template customization system
- Report generation tools (14-15) with progress tracking

**Key Tasks:**
- Enhance dashboard with interactive charts (Recharts)
- Implement advanced PDF export with Puppeteer
- Create template customization system
- Add export format validation
- Implement progress tracking for long-running operations
- Add performance optimization

### Phase 5: Testing, Security & Documentation (Days 23-28)
**Deliverables:**
- Comprehensive test suite with >85% coverage
- Security audit and hardening
- Complete API documentation with examples
- Docker containerization with production configurations
- Deployment guides and monitoring setup

**Key Tasks:**
- Comprehensive unit, integration, and E2E testing
- Security review and vulnerability assessment
- API documentation with interactive examples
- Docker setup with multi-stage builds
- Performance testing and optimization
- Monitoring and observability setup
- Deployment guides and operational documentation

## Quality Assurance

### Testing Strategy
```typescript
// Unit Tests
describe('JiraRepository', () => {
  it('should fetch sprint data correctly', async () => {
    // Test implementation
  })
})

// Integration Tests
describe('Sprint Report Generation', () => {
  it('should generate complete HTML report', async () => {
    // Full workflow test
  })
})

// E2E Tests
describe('MCP Tools', () => {
  it('should handle real API responses', async () => {
    // Test with actual APIs (in CI environment)
  })
})
```

### Performance Requirements
- **API Response Time**: < 2 seconds for individual tool calls
- **Report Generation**: < 30 seconds for complete sprint report
- **HTML Export**: < 10 seconds for typical sprint data
- **PDF Export**: < 15 seconds including chart rendering
- **Memory Usage**: < 512MB for typical workloads

### Security Requirements
- **Credential Management**: `.env` file only, no hardcoded secrets
- **API Security**: Proper error handling without exposing sensitive data
- **Input Validation**: All user inputs validated and sanitized
- **Rate Limiting**: Respect API rate limits with exponential backoff
- **Audit Logging**: All API calls and export operations logged
- **Environment Security**: `.env` file must be in `.gitignore` to prevent accidental commits

## Error Handling & Resilience

### Error Handling Strategy
```typescript
interface APIError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  userMessage: string;
}

class ErrorHandler {
  // Circuit breaker pattern for API calls
  private circuitBreaker: Map<string, CircuitBreakerState>;

  // Exponential backoff with jitter
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T>;

  // Categorize and transform errors
  categorizeError(error: any): APIError;

  // Graceful degradation strategies
  handleDegradedService(serviceName: string): Partial<ServiceResponse>;
}
```

### Resilience Patterns
- **Circuit Breaker**: Prevent cascade failures when APIs are down
- **Timeout Handling**: 30s timeout for API calls, 60s for report generation
- **Graceful Degradation**: Partial reports when some data is unavailable
- **Retry Logic**: Exponential backoff with jitter for transient failures

## Caching Architecture

### Caching Strategy
```typescript
interface CacheConfig {
  // Redis for distributed caching
  redis: {
    host: string;
    port: number;
    ttl: {
      sprintData: 1800; // 30 minutes
      issueDetails: 3600; // 1 hour
      repositoryInfo: 7200; // 2 hours
      generatedReports: 86400; // 24 hours
    };
  };

  // In-memory caching for frequently accessed data
  memory: {
    configData: 600; // 10 minutes
    userSessions: 1800; // 30 minutes
  };
}

class CacheManager {
  // Multi-layer caching strategy
  async get<T>(key: string, fallback: () => Promise<T>): Promise<T>;

  // Cache invalidation
  async invalidate(pattern: string): Promise<void>;

  // Cache warming for common queries
  async warmCache(sprintId: string): Promise<void>;

  // Cache statistics
  getStats(): CacheStats;
}
```

### Cache Key Patterns
```
jira:sprint:{sprintId}:data
jira:sprint:{sprintId}:issues
github:repo:{owner}:{repo}:info
github:repo:{owner}:{repo}:commits:{since}:{until}
report:{sprintId}:{hash}:html
```

## Rate Limiting & API Management

### Rate Limiting Strategy
```typescript
interface RateLimitConfig {
  jira: {
    requestsPerSecond: 10;
    burstLimit: 50;
    dailyLimit: 10000;
  };
  github: {
    requestsPerHour: 5000; // GitHub API limit
    searchRequestsPerMinute: 30;
    coreRequestsPerHour: 5000;
  };
}

class RateLimitManager {
  // Token bucket algorithm
  private tokenBuckets: Map<string, TokenBucket>;

  // Queue management for API calls
  private apiQueue: PriorityQueue<APIRequest>;

  // Rate limit monitoring
  async checkRateLimit(service: string): Promise<RateLimitStatus>;

  // Smart queuing with priority
  async queueRequest(request: APIRequest): Promise<void>;

  // Rate limit recovery strategies
  async handleRateLimitExceeded(service: string): Promise<void>;
}
```

### API Client Configuration
```typescript
const apiClientConfig = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  maxConcurrentRequests: 5,
  rateLimitBuffer: 0.1, // Use 90% of rate limit
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000
};
```

## Testing Strategy

### Testing Framework Specification
```json
{
  "dependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "supertest": "^6.3.0",
    "nock": "^13.3.0",
    "puppeteer": "^21.0.0",
    "jest-puppeteer": "^9.0.0"
  }
}
```

### Test Categories
```typescript
// Unit Tests - 70% coverage target
describe('JiraRepository', () => {
  beforeEach(() => {
    // Mock API responses with nock
  });

  it('should handle rate limit errors gracefully');
  it('should cache responses correctly');
  it('should retry transient failures');
});

// Integration Tests - API interactions
describe('Sprint Report Integration', () => {
  it('should generate complete report from real APIs');
  it('should handle missing GitHub repositories');
  it('should correlate issues with commits correctly');
});

// End-to-End Tests - Full workflow
describe('Report Generation E2E', () => {
  it('should export HTML report successfully');
  it('should export PDF with correct formatting');
  it('should handle large sprints (>100 issues)');
});

// Performance Tests
describe('Performance', () => {
  it('should complete report generation within 30 seconds');
  it('should handle concurrent requests');
  it('should not exceed 512MB memory usage');
});
```

### Test Configuration
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*'
  ]
};
```

## Deployment & Operations

### Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY templates/ ./templates/

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  sprint-reporter:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./reports:/app/sprint-reports
    restart: unless-stopped
```

**Note**: Ensure your `.env` file is present in the same directory as `docker-compose.yml` for proper environment variable loading.

### Monitoring & Logging
- **Health Checks**: API endpoint for server status
- **Metrics**: Prometheus metrics for API calls, response times
- **Logging**: Structured logging with different levels
- **Error Tracking**: Comprehensive error reporting and alerting

## Success Criteria

### Functional Requirements
✅ All 15 MCP tools function correctly with real APIs
✅ Sprint reports display comprehensive analytics and metrics
✅ HTML exports are standalone and fully functional
✅ PDF exports maintain quality and formatting
✅ Authentication works seamlessly with PAT tokens
✅ Data correlation accurately links Jira issues to GitHub activity

### Technical Requirements
✅ Response times meet performance targets
✅ Error handling provides clear, actionable messages
✅ Code coverage exceeds 90% for critical paths
✅ Documentation is complete and accurate
✅ Docker deployment works in production environments

### User Experience Requirements
✅ Reports are visually appealing and professional
✅ Interactive elements work correctly in HTML exports
✅ Data is accurate and up-to-date
✅ Export process completes reliably
✅ Error messages guide users to resolution

This comprehensive specification provides everything needed to build a production-ready MCP server for Jira-GitHub sprint reporting with modern UI components and professional export capabilities.