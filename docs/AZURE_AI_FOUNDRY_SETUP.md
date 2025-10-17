# 🔷 Azure AI Foundry Integration Guide

## Overview

**Yes! Your current implementation supports both Azure AI Foundry and Ollama.** This guide shows you how to use self-hosted LLMs through Azure AI Foundry with your existing agentic system.

### 🎯 What is Azure AI Foundry?

Azure AI Foundry (formerly Azure ML Model Catalog) lets you deploy open-source LLMs (like Llama, Mistral, Phi) on Azure infrastructure. You get:
- ✅ **Self-hosted models** (your Azure subscription)
- ✅ **OpenAI-compatible API** (easy integration)
- ✅ **Enterprise features** (security, compliance, scaling)
- ✅ **No vendor lock-in** (open-source models)

### 🔄 Compatibility Matrix

| Deployment Type | Supported | Implementation |
|----------------|-----------|----------------|
| **Ollama (Local)** | ✅ Yes | Current `OllamaAgent` |
| **Azure AI Foundry** | ✅ Yes | New `AzureAgent` (OpenAI-compatible) |
| **Azure OpenAI** | ✅ Yes | `AIAgent` (Claude API compatible) |
| **Claude API** | ✅ Yes | Current `AIAgent` |

---

## 🚀 Quick Start: Azure AI Foundry

### Architecture

```
┌─────────────────────────────────────────────────┐
│         Azure AI Foundry Integration            │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐                               │
│  │  AzureAgent  │  ← Your Code                  │
│  │ (TypeScript) │                               │
│  └──────┬───────┘                               │
│         │                                        │
│         ▼                                        │
│  ┌─────────────────┐                            │
│  │  OpenAI SDK     │  ← Uses OpenAI client      │
│  │  (TypeScript)   │                            │
│  └────────┬────────┘                            │
│           │                                      │
│           ▼                                      │
│  ┌─────────────────────┐                        │
│  │  Azure AI Foundry   │  ← Your Azure endpoint │
│  │  API Endpoint       │                        │
│  └────────┬────────────┘                        │
│           │                                      │
│           ▼                                      │
│  ┌─────────────────────┐                        │
│  │   Self-Hosted LLM   │  ← Llama, Mistral, etc│
│  │  (Llama 3.1, etc)   │                        │
│  └─────────────────────┘                        │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 📦 Step 1: Deploy Model to Azure AI Foundry

### Option A: Using Azure Portal

1. **Go to Azure AI Foundry**
   - Navigate to: https://ml.azure.com/
   - Select your workspace

2. **Deploy a Model**
   ```
   Model Catalog → Select Model → Deploy
   
   Recommended Models:
   - Meta-Llama-3.1-8B-Instruct
   - Meta-Llama-3.1-70B-Instruct
   - Mistral-7B-Instruct
   - Phi-3-medium-128k-instruct
   ```

3. **Get Endpoint Details**
   ```
   After deployment, note:
   - Endpoint URL: https://your-endpoint.inference.ml.azure.com/v1
   - API Key: Your Azure key
   - Deployment Name: Your model deployment name
   ```

### Option B: Using Azure CLI

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "Your Subscription Name"

# Deploy Llama 3.1 8B
az ml online-deployment create \
  --name llama-3-1-8b \
  --model azureml://registries/azureml-meta/models/Meta-Llama-3.1-8B-Instruct/versions/1 \
  --instance-type Standard_NC6s_v3 \
  --instance-count 1

# Get endpoint
az ml online-endpoint show -n llama-3-1-8b
```

---

## 🔧 Step 2: Install Dependencies

```bash
# Install OpenAI SDK (Azure AI Foundry uses OpenAI-compatible API)
npm install openai

# Already installed in your project ✅
```

---

## 💻 Step 3: Create Azure Agent

I'll create a new agent that uses Azure AI Foundry with OpenAI-compatible API:

### File: `src/agent/azure-agent.ts`

See implementation below (will be created).

---

## ⚙️ Step 4: Configure Environment

Add to your `.env` file:

```bash
# ============================================
# Azure AI Foundry Configuration
# ============================================

# Your Azure AI Foundry endpoint
AZURE_OPENAI_ENDPOINT=https://your-endpoint.inference.ml.azure.com/v1

# Your Azure API key
AZURE_OPENAI_API_KEY=your-azure-api-key-here

# Deployment name (model you deployed)
AZURE_OPENAI_DEPLOYMENT_NAME=llama-3-1-8b

# Optional: Model parameters
AZURE_OPENAI_TEMPERATURE=0.7
AZURE_OPENAI_MAX_TOKENS=4096
AZURE_OPENAI_MAX_ITERATIONS=10

# ============================================
# Your existing MCP credentials (unchanged)
# ============================================
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-token
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

---

## 🎯 Step 5: Usage

### Option 1: CLI (Interactive)

```bash
# Run Azure AI Foundry agent
npm run agent:azure

# Or with custom config
AZURE_OPENAI_DEPLOYMENT_NAME=llama-3-1-70b npm run agent:azure
```

### Option 2: API (HTTP Endpoints)

```bash
# Start HTTP server
npm run dev:http

# Query via API
curl -X POST http://localhost:3001/api/agent/azure/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "List all bugs in the current sprint",
    "conversationHistory": []
  }'
```

### Option 3: Programmatic

```typescript
import { AzureAgent } from '@/agent/azure-agent';
import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';

// Initialize
const mcpServer = new EnhancedMCPServer();
await mcpServer.initialize();

const agent = new AzureAgent(
  toolRegistry,
  context,
  {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
  }
);

// Query
const response = await agent.query("List all bugs in current sprint");
console.log(response.answer);
```

---

## 🆚 Comparison: Ollama vs Azure AI Foundry

| Feature | Ollama (Local) | Azure AI Foundry | Best For |
|---------|----------------|------------------|----------|
| **Cost** | FREE | ~$0.50-2.00/1M tokens | Ollama: Dev, Azure: Prod |
| **Setup** | 5 minutes | 15-30 minutes | Ollama: Faster |
| **Hardware** | Your machine (8GB+ RAM) | Azure (managed) | Azure: No local GPU needed |
| **Privacy** | 100% local | Azure cloud | Ollama: Air-gapped |
| **Scaling** | Single machine | Auto-scale | Azure: High traffic |
| **Reliability** | Depends on hardware | 99.9% SLA | Azure: Production |
| **Speed** | GPU-dependent | Consistent | Azure: More predictable |
| **Offline** | ✅ Works offline | ❌ Needs internet | Ollama: Offline work |
| **Models** | All Ollama models | Azure catalog | Similar selection |
| **API** | Ollama API | OpenAI-compatible | Azure: Standard API |

---

## 📊 Model Recommendations for Azure AI Foundry

### Production Workloads

| Model | Tokens/sec | Cost | Quality | Use Case |
|-------|-----------|------|---------|----------|
| **Llama-3.1-8B** | ~50-100 | $ | ⭐⭐⭐⭐ | General queries (recommended) |
| **Llama-3.1-70B** | ~20-40 | $$$ | ⭐⭐⭐⭐⭐ | Complex reasoning |
| **Mistral-7B** | ~60-120 | $ | ⭐⭐⭐ | Code-heavy tasks |
| **Phi-3-medium** | ~80-150 | $ | ⭐⭐⭐ | Fast, good quality |

### Development/Testing

Use Ollama locally for development, Azure for production.

---

## 🔐 Security Best Practices

### 1. Use Managed Identity (Recommended)

```typescript
import { DefaultAzureCredential } from '@azure/identity';

// Instead of API key, use managed identity
const credential = new DefaultAzureCredential();
const token = await credential.getToken('https://ml.azure.com');

const agent = new AzureAgent(toolRegistry, context, {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  credential: credential, // Use managed identity
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
});
```

### 2. Use Azure Key Vault

```bash
# Store secrets in Key Vault
az keyvault secret set \
  --vault-name "your-keyvault" \
  --name "azure-openai-key" \
  --value "your-key"

# Reference in code
import { SecretClient } from '@azure/keyvault-secrets';

const client = new SecretClient(
  "https://your-keyvault.vault.azure.net",
  new DefaultAzureCredential()
);
const secret = await client.getSecret("azure-openai-key");
```

### 3. Network Security

```bash
# Enable private endpoint for Azure AI
az ml online-endpoint create \
  --name secure-endpoint \
  --public-network-access Disabled \
  --vnet-name your-vnet \
  --subnet-name your-subnet
```

---

## 🔄 Migration Path

### Scenario 1: Ollama → Azure AI Foundry

```typescript
// Before (Ollama)
const agent = new OllamaAgent(toolRegistry, context);
const result = await agent.query("List bugs");

// After (Azure AI Foundry) - Same interface!
const agent = new AzureAgent(toolRegistry, context);
const result = await agent.query("List bugs");
```

**Migration Steps:**
1. ✅ Deploy model to Azure AI Foundry
2. ✅ Update environment variables
3. ✅ Change agent instantiation
4. ✅ Test thoroughly
5. ✅ Deploy

**Estimated Time:** 1-2 hours

### Scenario 2: Hybrid Approach (Recommended)

```typescript
export class MultiAgentOrchestrator {
  private ollamaAgent: OllamaAgent;
  private azureAgent: AzureAgent;
  
  async query(prompt: string, options: { environment?: 'dev' | 'prod' }) {
    // Use Ollama for development (free!)
    if (options.environment === 'dev' || process.env.NODE_ENV === 'development') {
      return this.ollamaAgent.query(prompt);
    }
    
    // Use Azure for production (reliable, scalable)
    return this.azureAgent.query(prompt);
  }
}
```

---

## 💰 Cost Comparison

### Ollama (Local)
```
Setup:     $0 (use existing hardware)
Per query: $0
Monthly:   $0
Annual:    $0

Hardware needed: 8GB+ RAM, GPU recommended
```

### Azure AI Foundry (Self-Hosted on Azure)
```
Setup:     ~$0 (Azure credits available)
Per query: ~$0.001-0.01 (depending on model)
Monthly:   ~$100-500 (based on usage)
Annual:    ~$1,200-6,000

Azure infrastructure: Managed, auto-scaling
```

### Break-Even Analysis
```
Queries per month: 10,000
Azure cost: ~$100-200/month

If you can run Ollama locally: Use Ollama
If you need reliability/scale: Use Azure
If you need both: Use hybrid approach
```

---

## 🎯 Use Cases

### Use Ollama When:
- ✅ Development and testing
- ✅ Privacy-sensitive data
- ✅ Offline work required
- ✅ Cost-sensitive projects
- ✅ Low query volume

### Use Azure AI Foundry When:
- ✅ Production deployments
- ✅ High query volume (>10,000/month)
- ✅ Need 99.9% uptime
- ✅ Auto-scaling required
- ✅ Enterprise compliance (SOC2, HIPAA, etc.)
- ✅ No local GPU available

### Hybrid Approach When:
- ✅ Development + production environments
- ✅ Cost optimization important
- ✅ Need flexibility
- ✅ Want best of both worlds

---

## 📝 API Endpoints

### Azure Agent Endpoints

All endpoints available at `http://localhost:3001`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/azure/chat` | POST | Single query |
| `/api/agent/azure/chat/stream` | POST | Streaming SSE |
| `/api/agent/azure/status` | GET | Check Azure connection |
| `/api/agent/azure/config` | GET | Get configuration |
| `/api/agent/azure/tools` | GET | List MCP tools |

### Example Request

```bash
curl -X POST http://localhost:3001/api/agent/azure/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Generate a comprehensive sprint report for sprint 123",
    "conversationHistory": []
  }'
```

### Example Response

```json
{
  "success": true,
  "data": {
    "answer": "I found sprint 123 with 45 issues...",
    "toolsUsed": ["jira_get_sprint", "jira_get_sprint_issues", "generate_comprehensive_report"],
    "iterations": 3,
    "cost": 0.0023,
    "provider": "azure-ai-foundry",
    "model": "llama-3-1-8b",
    "conversationHistory": [...]
  }
}
```

---

## 🔍 Troubleshooting

### Issue: "Unauthorized" or 401 Error

**Solution:**
```bash
# Check endpoint and key
echo $AZURE_OPENAI_ENDPOINT
echo $AZURE_OPENAI_API_KEY

# Verify deployment
az ml online-endpoint show -n your-endpoint

# Test connection
curl $AZURE_OPENAI_ENDPOINT/health \
  -H "Authorization: Bearer $AZURE_OPENAI_API_KEY"
```

### Issue: "Model not found"

**Solution:**
```bash
# List deployments
az ml online-deployment list --endpoint-name your-endpoint

# Use correct deployment name
export AZURE_OPENAI_DEPLOYMENT_NAME=correct-name
```

### Issue: Slow responses

**Solution:**
```bash
# Check instance type
az ml online-deployment show -n your-deployment

# Upgrade to GPU instance if needed
az ml online-deployment update \
  --name your-deployment \
  --instance-type Standard_NC24s_v3  # More powerful GPU
```

### Issue: High costs

**Solution:**
1. Use Ollama for development
2. Use smaller models (8B instead of 70B)
3. Enable autoscaling with min instances = 0
4. Set up budget alerts

```bash
# Set autoscaling
az ml online-deployment update \
  --name your-deployment \
  --scale-settings-min-instances 0 \
  --scale-settings-max-instances 5
```

---

## 🧪 Testing

### Test Azure Connection

```typescript
// test-azure-connection.ts
import { AzureAgent } from '@/agent/azure-agent';

async function testAzureConnection() {
  const agent = new AzureAgent(toolRegistry, context);
  
  // Test basic query
  const response = await agent.query("Hello, are you working?");
  console.log('✅ Azure connection successful');
  console.log('Response:', response.answer);
  
  // Test tool calling
  const toolResponse = await agent.query("List all sprints");
  console.log('✅ Tool calling works');
  console.log('Tools used:', toolResponse.toolsUsed);
}

testAzureConnection();
```

### Run Tests

```bash
# Unit tests
npm test src/agent/azure-agent.test.ts

# Integration test
tsx test-azure-connection.ts
```

---

## 📚 Additional Resources

### Azure AI Foundry
- 🔗 Portal: https://ml.azure.com/
- 📖 Docs: https://learn.microsoft.com/azure/ai-studio/
- 💰 Pricing: https://azure.microsoft.com/pricing/details/machine-learning/

### Ollama (Local Alternative)
- 🔗 Website: https://ollama.ai/
- 📖 Docs: See `docs/OLLAMA_AGENT_SETUP.md`
- 💰 Cost: FREE

### OpenAI SDK (Used by Azure Agent)
- 🔗 GitHub: https://github.com/openai/openai-node
- 📖 Docs: https://platform.openai.com/docs/api-reference

---

## ✅ Quick Setup Checklist

- [ ] Deploy model to Azure AI Foundry
- [ ] Get endpoint URL and API key
- [ ] Add credentials to `.env` file
- [ ] Install dependencies (`npm install openai`)
- [ ] Create `AzureAgent` (see code below)
- [ ] Test connection
- [ ] Update routes/CLI to use AzureAgent
- [ ] Deploy to production

---

## 🎉 Summary

**You now have THREE agent options:**

1. **OllamaAgent** - Local, free, privacy-first
2. **AzureAgent** - Self-hosted on Azure, reliable, scalable
3. **AIAgent** - Cloud (Claude/OpenAI), premium quality

**Recommended Strategy:**
- 🧪 **Development:** Use Ollama (free, fast iteration)
- 🚀 **Production:** Use Azure AI Foundry (reliable, scalable)
- 🎯 **Premium:** Use Claude/OpenAI for complex reasoning

**All three share the same interface** - switch between them easily!

---

**Next Steps:**
1. Review the `AzureAgent` implementation (created below)
2. Deploy a model to Azure AI Foundry
3. Configure environment variables
4. Test and deploy!

**Questions?** Check the full documentation or Azure AI Foundry docs.
