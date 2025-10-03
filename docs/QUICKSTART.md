# Quick Start Guide - Sprint Reporter MCP

## 🚀 Get Started in 5 Minutes

### Step 1: Start the Web API Server

The web server is already running! If you need to restart it:

```bash
# Development mode (with hot reload)
npm run dev:web
```

The server is now listening at: **http://localhost:3000**

### Step 2: Test the Connection

Open your browser or use curl to test:

```bash
# Check server health
curl http://localhost:3000/api/health

# Get server info
curl http://localhost:3000/api/info
```

### Step 3: Get Your Jira Board ID

1. Go to your Jira board in the browser
2. Look at the URL: `https://your-jira.atlassian.net/jira/software/c/projects/PROJ/boards/123`
3. The board ID is the number at the end (e.g., `123`)

### Step 4: Get Active Sprints

Replace `YOUR_BOARD_ID` with your actual board ID:

```bash
curl "http://localhost:3000/api/sprints?board_id=YOUR_BOARD_ID&state=active"
```

**Example:**
```bash
curl "http://localhost:3000/api/sprints?board_id=123&state=active"
```

**Response:**
```json
{
  "sprints": [
    {
      "id": "456",
      "name": "Sprint 23",
      "state": "active",
      "startDate": "2025-09-15T00:00:00.000Z",
      "endDate": "2025-09-29T00:00:00.000Z"
    }
  ]
}
```

### Step 5: Generate a Sprint Report

Use the sprint ID from Step 4:

```bash
curl -X POST http://localhost:3000/api/reports/sprint \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "456",
    "format": "json",
    "include_commits": false,
    "include_prs": false,
    "include_velocity": true,
    "include_burndown": true,
    "theme": "default"
  }'
```

## 📱 Web Application Integration

### Simple HTML + JavaScript Example

Create an `index.html` file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Sprint Reporter</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .sprint { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
        button { padding: 10px 20px; cursor: pointer; }
        .loading { color: #666; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>Sprint Reporter Dashboard</h1>

    <div>
        <label>Board ID: <input type="text" id="boardId" value="123"></label>
        <button onclick="fetchSprints()">Load Sprints</button>
    </div>

    <div id="status"></div>
    <div id="sprints"></div>

    <script>
        const API_URL = 'http://localhost:3000';

        async function fetchSprints() {
            const boardId = document.getElementById('boardId').value;
            const status = document.getElementById('status');
            const sprints = document.getElementById('sprints');

            status.innerHTML = '<p class="loading">Loading sprints...</p>';
            sprints.innerHTML = '';

            try {
                const response = await fetch(`${API_URL}/api/sprints?board_id=${boardId}&state=active`);
                const data = await response.json();

                if (data.error) {
                    status.innerHTML = `<p class="error">Error: ${data.error}</p>`;
                    return;
                }

                status.innerHTML = '<p>✅ Sprints loaded successfully!</p>';

                data.sprints.forEach(sprint => {
                    sprints.innerHTML += `
                        <div class="sprint">
                            <h3>${sprint.name}</h3>
                            <p>Status: ${sprint.state}</p>
                            <p>Sprint ID: ${sprint.id}</p>
                            <button onclick="generateReport('${sprint.id}')">Generate Report</button>
                        </div>
                    `;
                });
            } catch (error) {
                status.innerHTML = `<p class="error">Error: ${error.message}</p>`;
            }
        }

        async function generateReport(sprintId) {
            const status = document.getElementById('status');
            status.innerHTML = '<p class="loading">Generating report...</p>';

            try {
                const response = await fetch(`${API_URL}/api/reports/sprint`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sprint_id: sprintId,
                        format: 'json',
                        include_commits: false,
                        include_prs: false,
                        include_velocity: true,
                        include_burndown: true,
                        theme: 'default'
                    })
                });

                const report = await response.json();

                if (report.error) {
                    status.innerHTML = `<p class="error">Error: ${report.message}</p>`;
                    return;
                }

                status.innerHTML = '<p>✅ Report generated successfully!</p>';
                console.log('Report:', report);

                // Display or download the report
                alert('Report generated! Check the browser console for details.');
            } catch (error) {
                status.innerHTML = `<p class="error">Error: ${error.message}</p>`;
            }
        }

        // Check server health on page load
        async function checkHealth() {
            try {
                const response = await fetch(`${API_URL}/api/health`);
                const health = await response.json();
                console.log('Server health:', health);
                document.getElementById('status').innerHTML =
                    `<p>Server Status: ${health.status === 'healthy' ? '✅ Healthy' : '⚠️ ' + health.status}</p>`;
            } catch (error) {
                document.getElementById('status').innerHTML =
                    '<p class="error">❌ Cannot connect to server. Make sure it\'s running on port 3000.</p>';
            }
        }

        checkHealth();
    </script>
</body>
</html>
```

Open this file in your browser, and you'll have a working sprint reporter interface!

## 🎯 Common Use Cases

### 1. Get Sprint Metrics

```bash
curl "http://localhost:3000/api/sprints/456/metrics?include_velocity=true&include_burndown=true"
```

### 2. Get Sprint Issues

```bash
curl "http://localhost:3000/api/sprints/456/issues?max_results=50"
```

### 3. Check GitHub Repository

```bash
curl "http://localhost:3000/api/github/repos/your-org/your-repo/commits?since=2025-09-01"
```

## 🐛 Troubleshooting

### Server Not Responding?

Check if it's running:
```bash
curl http://localhost:3000/api/health
```

If not, start it:
```bash
npm run dev:web
```

### Jira Connection Issues?

Your current setup shows Jira returning 500 errors. This could be:

1. **Invalid API Token** - Verify in .env:
   ```bash
   # Check your token
   cat .env | grep JIRA
   ```

2. **Wrong Base URL** - Should be:
   ```bash
   JIRA_BASE_URL=https://your-company.atlassian.net
   ```

3. **Test manually:**
   ```bash
   curl -u your-email@company.com:YOUR_TOKEN \
     https://your-jira.atlassian.net/rest/api/3/myself
   ```

### GitHub Connection Working ✅

Your GitHub integration is working perfectly! You can:
- Fetch commits
- Get pull requests
- Check repository stats

## 📚 Next Steps

1. **Read the full guide:** See `USAGE_GUIDE.md` for complete API documentation
2. **Explore endpoints:** Try different API endpoints
3. **Build your app:** Use the HTML example as a starting point
4. **Integrate:** Add the API to your existing web application

## 🔗 Quick Reference

| Action | Endpoint | Method |
|--------|----------|--------|
| Health Check | `/api/health` | GET |
| Server Info | `/api/info` | GET |
| Get Sprints | `/api/sprints?board_id=123` | GET |
| Sprint Issues | `/api/sprints/456/issues` | GET |
| Sprint Metrics | `/api/sprints/456/metrics` | GET |
| Generate Report | `/api/reports/sprint` | POST |

## 💡 Pro Tips

1. **Start Simple:** Test with just velocity and burndown first
2. **Check Logs:** Watch the terminal for real-time server logs
3. **Use DevTools:** Open browser console to see API responses
4. **CORS:** The server allows all origins in development mode

## Need Help?

The server is currently running at: **http://localhost:3000**

Test it now:
```bash
curl http://localhost:3000/api/info
```

You should see server information confirming everything is working! 🎉
