#!/bin/bash
# Start MCP Inspector for NextReleaseMCP
# This allows you to interactively test all MCP tools

echo "Starting MCP Inspector for NextReleaseMCP..."
echo ""
echo "📋 Available Tools:"
echo "  - Jira: get_sprint_data, get_sprint_issues, get_issue_details, search_issues, get_board_sprints"
echo "  - GitHub: get_commits, get_pull_requests, get_repo_stats"
echo "  - Reports: generate_sprint_report, generate_comprehensive_report"
echo "  - Utils: get_sprint_date_range, parse_sprint_name"
echo ""
echo "🔗 Inspector will open in your browser"
echo "⚠️  Make sure your .env file has valid credentials"
echo ""

# Run MCP Inspector with your server
npx @modelcontextprotocol/inspector node dist/server.js
