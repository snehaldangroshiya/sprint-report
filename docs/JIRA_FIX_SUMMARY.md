# Jira Connection Fix - Summary

## Problem Identified

The Jira integration was failing with **500 Internal Server Error** due to:

1. **Wrong API Version**: Code was using Jira Cloud API v3 (`/rest/api/3/`) instead of Jira Server API v2 (`/rest/api/2/`)
2. **Wrong Authentication Method**: Code was using Basic Auth (email:token) instead of Bearer Token authentication required by Jira Server

## Root Cause

Your Jira instance is **Jira Server 9.12.27** (not Jira Cloud), which has different requirements:

| Aspect | Jira Cloud | Jira Server (your instance) |
|--------|------------|----------------------------|
| API Version | `/rest/api/3/` | `/rest/api/2/` |
| Authentication | Basic Auth (email:token) | Bearer Token |
| Endpoint | `https://company.atlassian.net` | `https://jira.sage.com` |

## Files Fixed

### 1. `/home/sd/data/project-2025/NextReleaseMCP/src/clients/jira-client.ts`

**Changes:**
- Line 113: Added `'Authorization': 'Bearer ${config.jira.apiToken}'` header
- Line 120: Removed basic auth configuration
- Line 316: Changed `/rest/api/3/myself` → `/rest/api/2/myself` (health check)
- Line 395: Changed `/rest/api/3/myself` → `/rest/api/2/myself` (validation)

**Before:**
```typescript
this.httpClient.defaults.auth = {
  username: config.jira.email,
  password: config.jira.apiToken,
};
```

**After:**
```typescript
headers: {
  'Authorization': `Bearer ${config.jira.apiToken}`,
}
```

### 2. `/home/sd/data/project-2025/NextReleaseMCP/src/config/environment.ts`

**Changes:**
- Line 229: Changed `/rest/api/3/myself` → `/rest/api/2/myself`

## Verification Tests

### Manual Curl Tests:

**❌ Basic Auth (Fails):**
```bash
curl -u "email:token" https://jira.sage.com/rest/api/2/myself
# Result: 500 Internal Server Error
```

**✅ Bearer Token (Works):**
```bash
curl -H "Authorization: Bearer TOKEN" https://jira.sage.com/rest/api/2/myself
# Result: 200 OK with user data
```

### Health Check Results:

**Before Fix:**
```json
{
  "status": "degraded",
  "checks": [
    {
      "name": "jira",
      "status": "unhealthy",
      "responseTime": 5787
    }
  ]
}
```

**After Fix:**
```json
{
  "status": "healthy",
  "checks": [
    {
      "name": "jira",
      "status": "healthy",
      "responseTime": 556
    },
    {
      "name": "github",
      "status": "healthy",
      "responseTime": 457
    },
    {
      "name": "cache",
      "status": "healthy",
      "responseTime": 3
    }
  ]
}
```

## Current Status

✅ **Jira Connection: FIXED**
- Health check passing
- Response time: ~556ms
- Authentication working with Bearer token
- API v2 endpoints accessible

✅ **GitHub Connection: Working**
- Already working before fix
- Response time: ~457ms

✅ **Cache Service: Working**
- Response time: ~3ms

## Testing the Fix

Test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Expected output:
```json
{
  "status": "healthy",
  "checks": [
    {"name": "jira", "status": "healthy"},
    {"name": "github", "status": "healthy"},
    {"name": "cache", "status": "healthy"}
  ]
}
```

## Notes for Future

1. **Jira Server vs Cloud**: Always check which Jira type you're connecting to
2. **API Version**: Jira Server uses v2, Jira Cloud uses v3
3. **Authentication**:
   - Jira Server: Bearer Token (`Authorization: Bearer TOKEN`)
   - Jira Cloud: Basic Auth (email:token with base64 encoding)
4. **Health Check**: The `/rest/api/2/myself` endpoint is perfect for testing connection

## Server Information

Your Jira instance details (from `/rest/api/2/serverInfo`):
```json
{
  "baseUrl": "https://jira.sage.com",
  "version": "9.12.27",
  "versionNumbers": [9, 12, 27],
  "deploymentType": "Server",
  "buildNumber": 9120027,
  "buildDate": "2025-09-02T00:00:00.000+0000"
}
```

## Remaining Work

The MCP tools need to be registered properly for the web API endpoints to work. This is a separate issue from the Jira connection, which is now fully resolved.
