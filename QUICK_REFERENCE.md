# CareerKaki - Quick Reference Guide

**Status:** MVP Complete | **Branch:** feature/agentic-pipeline-v1 | **Date:** 2026-06-09

## 🚀 Get Started in 5 Minutes

```bash
# 1. Start dev server
cd apps/web && npm run dev

# 2. Open chrome://extensions → Load unpacked → apps/web/extension

# 3. Visit any webpage, open extension, click "Start Workflow"

# Done! Watch 6 agents run in real-time
```

## 📁 File Quick Map

| What | Where | Lines |
|-----|-------|-------|
| Workflow orchestrator | `lib/workflow-store.ts` | ~100 |
| LLM abstraction | `lib/llm-provider.ts` | ~20 |
| Start workflow API | `app/api/workflows/start/route.ts` | ~10 |
| Get workflow status | `app/api/workflows/[id]/route.ts` | ~15 |
| Approve workflow API | `app/api/workflows/[id]/approve/route.ts` | ~10 |
| Extension context menu | `extension/background.js` | ~35 |
| Extension popup UI | `extension/popup.html` + `popup.js` + `popup.css` | ~30 + ~150 + ~50 |
| Extension config | `extension/manifest.json` | ~15 |

## 🎯 Agent Pipeline (6 Steps)

1. 📋 **job-extractor** → Extract job details
2. 🔍 **company-researcher** → Research company  
3. 📄 **resume-reader** → Read your resume
4. ✍️ **resume-writer** → Generate tailored resume
5. 🎯 **role-matcher** → Find similar roles
6. 💬 **social-composer** → Create LinkedIn post

**Execution:** Sequential, 500ms polling from extension popup

## 🔧 Environment Config

```bash
# .env.local
NEXT_PUBLIC_AWS_WORKER_URL=https://mnjyeg13s4.execute-api.us-west-2.amazonaws.com/prod/

# Optional: Enable Bedrock (requires AWS credentials)
USE_BEDROCK=false
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## 🐛 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| 404 on GET `/api/workflows/[id]` | **Await params:** `const { params: p } = await context; const { id } = await p;` |
| Store lost on refresh | **Use globalThis:** `const getStore = () => { if (!(global).__workflowStore) ... return (global).__workflowStore; }` |
| Module not found in build cache | `rm -rf .next && npm run dev` |
| Extension can't reach localhost | Dev server auto-detects port; extension derives origin from active tab |

## 📊 Data Flow

```
User Input
    ↓
Extension popup auto-extracts page content
    ↓
User clicks "Start Workflow"
    ↓
POST /api/workflows/start { input }
    ↓
createWorkflow() → init 6 pending tasks, start runAgents() async
    ↓
Return { id, status: 'running' }
    ↓
Popup polls GET /api/workflows/{id} every 500ms
    ↓
runAgents() loop: per task → callLLM(input) → shape result → status='done'/'error'
    ↓
Popup shows timeline: pending → running → done
    ↓
When complete, user clicks "Approve"
    ↓
POST /api/workflows/{id}/approve
    ↓
Set approved=true, status='approved'
```

## 🧠 Key Concepts

### 1. **GlobalThis Singleton (Persistence)**
```typescript
const getStore = () => {
  if (!(global).__workflowStore) {
    (global).__workflowStore = new Map();
  }
  return (global).__workflowStore;
};
// Persists across hot reloads; lost on server restart
// Replace with DynamoDB for production
```

### 2. **Async Route Parameters (Next.js 15)**
```typescript
// ✅ Correct
export async function GET(request, context) {
  const { params: p } = await context;
  const { id } = await p;
}

// ❌ Wrong (causes 404)
export async function GET(request, { params }) {
  const { id } = params;
}
```

### 3. **Auto-Page Extraction**
- Extension injects script via `chrome.scripting.executeScript`
- Script searches selectors: `[data-testid], .job-description, article, main, p`
- Returns first match or user selection (max 500 chars)

### 4. **LLM Abstraction**
```typescript
callLLM(input) {
  if (USE_BEDROCK) {
    return fetch('/api/llm/bedrock', { body: input });
  } else {
    return fetch(AWS_WORKER_URL, { body: input });
  }
}
```

## 📋 Workflow Type

```typescript
type Workflow = {
  id: string;                // UUID
  input: string;             // Job description
  status: 'running' | 'complete' | 'approved';
  tasks: Task[];             // 6 items
  createdAt: string;         // ISO
  approved?: boolean;
};

type Task = {
  agent: string;             // 'resume-writer', etc.
  description: string;       // 'Build tailored resume'
  icon: string;              // '✍️'
  status: 'pending' | 'running' | 'done' | 'error';
  result?: any;              // Agent output
};
```

## 🚨 Production Checklist

- [ ] Replace globalThis with DynamoDB
- [ ] Set USE_BEDROCK=true and test Bedrock calls
- [ ] Move Bedrock logic to Lambda worker (cost optimization)
- [ ] Deploy orchestrator to Vercel with env vars
- [ ] Add input validation (max 50KB per request)
- [ ] Implement rate limiting on /api/workflows/start
- [ ] Set up CloudWatch logging + Grafana dashboards
- [ ] Add email notifications on workflow completion
- [ ] Integrate Stripe billing on /approve endpoint
- [ ] Security audit: secrets, CSP, permissions

## 🔗 External Resources

- **Git Repo:** https://github.com/sgirabin/career-kaki
- **AWS Lambda:** career-kaki-worker (us-west-2)
- **API Gateway:** mnjyeg13s4 (HTTP API)
- **Bedrock Model:** anthropic.claude-3-sonnet-20240229-v1:0

## 📞 Support

For detailed info, see [KNOWLEDGE_TRANSFER.md](./KNOWLEDGE_TRANSFER.md) (13 sections, ~2000 lines)

**Original Dev:** Isak Rabin (@sgirabin)
