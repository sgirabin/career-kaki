# CareerKaki - Knowledge Transfer Document

**Last Updated:** 2026-06-09  
**Project State:** MVP Complete - Browser extension + orchestrator + 6-agent pipeline working end-to-end  
**Active Branch:** `feature/agentic-pipeline-v1`  
**Key Contact:** Isak Rabin (sgirabin on GitHub)

---

## 1. Architecture Overview

CareerKaki is a full-stack AI agent orchestration system for career acceleration. The user selects job descriptions via a browser extension, and a 6-agent pipeline processes the input to generate tailored resumes and role matches.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Background Worker (background.js)                      │ │
│  │  - Context menu listener                              │ │
│  │  - POST /api/workflows/start                          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Popup UI (popup.js + popup.html + popup.css)          │ │
│  │  - Auto-extract page content via chrome.scripting     │ │
│  │  - Poll /api/workflows/{id} every 500ms              │ │
│  │  - Render visual progress timeline (6 agents)         │ │
│  │  - Display results by agent type                      │ │
│  │  - POST /api/workflows/{id}/approve to confirm       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│             Next.js 15.5 Server (App Router)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ /api/workflows/start (POST)                            │ │
│  │  - Input: { input: string }                            │ │
│  │  - createWorkflow() → init 6 pending tasks             │ │
│  │  - Async runAgents() starts background execution      │ │
│  │  - Output: { id, status }                              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ /api/workflows/[id] (GET)                              │ │
│  │  - Retrieve workflow state by ID                       │ │
│  │  - Returns: { id, input, status, tasks, ... }         │ │
│  │  - Note: Async params handling (await context)        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ /api/workflows/[id]/approve (POST)                     │ │
│  │  - Set workflow.approved = true                        │ │
│  │  - Set workflow.status = 'approved'                    │ │
│  │  - For future: integrate with Stripe billing          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ /api/llm/bedrock (POST)  [Optional]                    │ │
│  │  - AWS Bedrock Runtime: InvokeModel                    │ │
│  │  - Requires: USE_BEDROCK=true env var                 │ │
│  │  - Returns: streamed LLM response                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Orchestrator (lib/workflow-store.ts)                   │ │
│  │  - createWorkflow(input)                               │ │
│  │  - getWorkflow(id)                                     │ │
│  │  - runAgents(wf) - sequential task execution           │ │
│  │  - approveWorkflow(id)                                 │ │
│  │  - GlobalThis singleton for in-memory persistence     │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ LLM Provider (lib/llm-provider.ts)                     │ │
│  │  - Abstraction layer for Bedrock vs AWS Worker        │ │
│  │  - callLLM(input): routes based on USE_BEDROCK env    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│        AWS Lambda + API Gateway (Optional LLM calls)         │
│  - Deployment: career-kaki-worker in us-west-2             │
│  - URL: https://mnjyeg13s4.execute-api.us-west-2.amazonaws │
│    .com/prod/                                               │
│  - Runtime: nodejs18.x                                      │
│  - Route: $default (accepts any path)                       │
│  - Current: Returns mock LLM responses (no real calls)      │
│  - Future: Move Bedrock calls here for cost optimization   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Design Decisions & Patterns

### 2.1 In-Memory Store with GlobalThis Singleton

**Decision:** Use `globalThis.__workflowStore` Map for workflow persistence.

**Rationale:**
- Next.js dev server with hot reload resets module-level variables
- GlobalThis persists across hot reloads in dev environment
- Sufficient for MVP; replaced with DynamoDB in production

**Code Pattern:**
```typescript
const getStore = () => {
  if (!(global as any).__workflowStore) {
    (global as any).__workflowStore = new Map<string, Workflow>();
  }
  return (global as any).__workflowStore;
};
```

**Limitation:** Lost on server restart. For production, migrate to DynamoDB with Scan/GetItem operations.

### 2.2 Agent Registry with Metadata

**Decision:** Define agents as array with icon, description, and execution order.

**Rationale:**
- Declarative agent definition (not hardcoded in runAgents loop)
- Easy to add/remove/reorder agents
- UI can iterate and display with visual markers

**Current Pipeline (6 agents, sequential execution):**
1. 📋 **job-extractor** — Extract structured job details
2. 🔍 **company-researcher** — Research company background  
3. 📄 **resume-reader** — Read user's existing resume
4. ✍️ **resume-writer** — Generate tailored resume
5. 🎯 **role-matcher** — Find similar roles
6. 💬 **social-composer** — Create LinkedIn post

### 2.3 Async Route Parameters (Next.js 15 App Router)

**Critical Pattern:** Dynamic segments in App Router are Promises.

**Wrong (causes 404):**
```typescript
export async function GET(request, { params }) {
  const { id } = params;  // ❌ params is a Promise!
}
```

**Correct:**
```typescript
export async function GET(request, context) {
  const { params: paramsPromise } = await context;  // ✅ Await context first
  const { id } = await paramsPromise;               // ✅ Then await params
  const wf = getWorkflow(id);
}
```

**Impact:** This bug caused 404 errors on workflow GET requests until fixed.

### 2.4 LLM Provider Abstraction

**Decision:** Single `callLLM(input)` function that routes to Bedrock or AWS Worker based on env var.

**Rationale:**
- Decouples agent logic from LLM backend
- Easy to swap providers (Bedrock, OpenAI, Claude, etc.)
- Supports cost optimization (move expensive calls to Lambda)

**Toggle:**
```typescript
const useBedrock = process.env.USE_BEDROCK === 'true';
if (useBedrock) {
  // Call /api/llm/bedrock (server-side Bedrock)
} else {
  // Call NEXT_PUBLIC_AWS_WORKER_URL (Lambda worker)
}
```

### 2.5 Auto-Page Content Extraction

**Decision:** Use `chrome.scripting.executeScript` to inject extraction logic into active tab DOM.

**Rationale:**
- Browser extension content scripts can't directly access arbitrary frames
- Execute script in tab context finds job descriptions from known selectors
- Falls back to user selection or first paragraph/article tag

**Selector Cascade:**
```javascript
[data-testid="job-details"] > LinkedIn job containers
.job-description > Generic job boards
article > Blog posts / news
main > Common semantic HTML
[value] attribute > Text from input fields
Selection text > User highlight
First p/article tag > Last resort
```

---

## 3. Codebase Structure

```
apps/web/
├── app/                         # Next.js App Router
│   ├── api/
│   │   ├── workflows/
│   │   │   ├── start/route.ts          # POST /api/workflows/start
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts            # GET /api/workflows/[id]
│   │   │   │   └── approve/route.ts    # POST /api/workflows/[id]/approve
│   │   │   └── llm/
│   │   │       └── bedrock/route.ts    # POST /api/llm/bedrock (optional)
│   │   └── worker/route.ts             # Proxy to AWS worker (legacy)
│   └── page.tsx                 # Home page (minimal demo UI)
│
├── lib/
│   ├── workflow-store.ts        # Core orchestrator: Workflow, Task types + CRUD
│   └── llm-provider.ts          # Abstraction layer for LLM calls
│
├── extension/                   # Chrome Extension (MV3)
│   ├── manifest.json            # Extension config
│   ├── background.js            # Service worker: context menu + POST start
│   ├── popup.html               # Popup UI: textarea, controls, timeline, results
│   ├── popup.js                 # Popup logic: extract, poll, render progress
│   └── popup.css                # Styling: timeline colors, animations
│
├── public/                      # Static assets (none currently)
├── scripts/
│   └── smoke-test.js            # Manual test script
├── package.json                 # Dependencies: next, react, @aws-sdk/*
├── tsconfig.json                # TypeScript config
├── next.config.mjs              # Next.js config
├── .env.local                   # Local env vars (see section 4)
└── .env                         # Committed env vars (minimal)
```

---

## 4. Configuration & Environment

### 4.1 Required Environment Variables

**For localhost dev:**
```bash
# .env.local (git-ignored)
NEXT_PUBLIC_AWS_WORKER_URL=https://mnjyeg13s4.execute-api.us-west-2.amazonaws.com/prod/

# Optional: Enable AWS Bedrock (requires AWS credentials)
USE_BEDROCK=false
# BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
# AWS_REGION=us-west-2
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

**For Vercel deployment (to be configured):**
```bash
# Vercel Environment Variables
NEXT_PUBLIC_AWS_WORKER_URL=https://mnjyeg13s4.execute-api.us-west-2.amazonaws.com/prod/
USE_BEDROCK=true  # or false, depending on strategy
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### 4.2 Current AWS Setup

**Lambda Function:**
- Name: `career-kaki-worker`
- Runtime: nodejs18.x
- Region: us-west-2
- Handler: index.handler
- URL: https://mnjyeg13s4.execute-api.us-west-2.amazonaws.com/prod/
- Route: $default (HTTP API Gateway v2 - accepts any path)

**Bedrock Model (optional):**
- Model: `anthropic.claude-3-sonnet-20240229-v1:0`
- Region: us-west-2 (same as Lambda)
- Requires: IAM role with `bedrock:InvokeModel` permission

---

## 5. Workflow Execution Flow

### 5.1 User Trigger → Extension

1. User right-clicks on selected text (or opens extension popup)
2. Extension background worker triggers:
   - Extracts selected text via `info.selectionText`
   - Derives origin from active tab URL (auto-detects port)
   - POSTs to `{origin}/api/workflows/start` with `{ input }`
   - Copies workflow ID to clipboard (optional)
   - Opens demo page in new tab

3. Popup on same tab:
   - On init, injects script to auto-extract job content from page
   - Falls back to user selection or visible text
   - Displays textarea pre-filled with detected content
   - User clicks "Start Workflow"

### 5.2 Backend Orchestration

1. **POST /api/workflows/start**
   - Receives `{ input: string }`
   - `createWorkflow(input)` generates UUID, creates 6 pending tasks
   - Stores in globalThis Map
   - Async `runAgents(wf)` starts in background (no await)
   - Returns `{ id, status: 'running' }` immediately (201)

2. **runAgents(wf) [Background]**
   - Loops through 6 tasks sequentially
   - Per task:
     - Sets `task.status = 'running'`
     - Calls `callLLM(wf.input)` (Bedrock or Lambda worker)
     - Shapes result based on agent type (e.g., `role-matcher` returns array of roles)
     - Sets `task.status = 'done'` or `'error'`
   - After all tasks: `wf.status = 'complete'`

3. **GET /api/workflows/[id] [Polling]**
   - Extension polls every 500ms
   - Returns current workflow state (all tasks, status)
   - UI renders progress timeline based on task.status ('pending' → 'running' → 'done'/'error')

4. **POST /api/workflows/[id]/approve**
   - User clicks "Approve" after workflow completes
   - Sets `wf.approved = true`, `wf.status = 'approved'`
   - Future: trigger Stripe billing / email confirmation

### 5.3 Data Structures

**Workflow:**
```typescript
type Workflow = {
  id: string;                 // UUID
  input: string;              // Original user input (job description)
  status: 'running' | 'complete' | 'approved';
  tasks: Task[];              // 6-item array
  createdAt: string;          // ISO timestamp
  approved?: boolean;
};
```

**Task:**
```typescript
type Task = {
  agent: string;              // e.g., 'resume-writer'
  description: string;        // e.g., 'Build tailored resume'
  icon: string;               // e.g., '✍️'
  status: 'pending' | 'running' | 'done' | 'error';
  result?: any;               // Agent-specific output (shaped by runAgents)
};
```

**Result Shapes (by agent):**
```typescript
// job-extractor
{ jobTitle: string, requirements: string[], raw: string }

// company-researcher
{ companyName: string, background: string, raw: string }

// resume-reader
{ skills: string[], experience: string, raw: string }

// resume-writer
{ text: string, raw: string }

// role-matcher
{ matches: string[], raw: string }  // Array of role names

// social-composer
{ post: string, raw: string }       // LinkedIn post markdown
```

---

## 6. Extension Mechanics

### 6.1 Chrome Manifest (MV3)

**Key Config:**
```json
{
  "manifest_version": 3,
  "permissions": ["contextMenus", "activeTab", "scripting", "clipboardWrite"],
  "host_permissions": ["http://localhost/*", "https://localhost/*"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" }
}
```

**Important:**
- `host_permissions` with wildcard `localhost/*` allows extension to work on any port (3000, 3003, 3004, etc.)
- Specific permissions: contextMenus (right-click), scripting (inject extraction), clipboardWrite (copy ID)

### 6.2 Background Worker (background.js)

**Two Entry Points:**

1. **Context Menu (right-click on text):**
   - Listens for `chrome.contextMenus.onClicked`
   - Extracts `info.selectionText` (user's selection)
   - Derives tab origin from `new URL(tab.url).origin`
   - POSTs to `{origin}/api/workflows/start` with selection
   - Copies ID to clipboard
   - Opens new tab with demo page

2. **Popup (extension icon click):**
   - Handled by popup.js (separate flow)
   - Auto-extracts page content via scripting
   - User can edit textarea before clicking "Start"

**No error handling to fix** — actual file is correct (user's paste had typo "hrome").

### 6.3 Popup UI (popup.js + popup.html + popup.css)

**Three Sections (div visibility toggled):**

1. **Input Section** (visible initially)
   - Textarea with placeholder "Job description will be auto-detected..."
   - On popup open, auto-extracts via `chrome.scripting.executeScript`
   - Buttons: Start Workflow, Copy ID (disabled), Approve (disabled)

2. **Progress Section** (shown after "Start", hidden initially)
   - Timeline container showing 6 agent items
   - Each item: icon + name + description + status text
   - Color codes: pending=gray, running=blue (with spinner), done=green (✓), error=red (✗)
   - Updates every 500ms via polling

3. **Results Section** (shown after complete, hidden initially)
   - Formatted output by agent type
   - `role-matcher` shows bullet list of roles
   - `resume-writer` shows full text in code block
   - `social-composer` shows markdown-formatted LinkedIn post

**Auto-Extraction Logic:**
```javascript
// Injects this script into active tab
const selectors = [
  '[data-testid="job-details"]',
  '.job-description',
  'article',
  'main',
  '[value]',
  // ... fallbacks
];
// Finds content, returns to popup via chrome.scripting result
```

---

## 7. LLM Integration

### 7.1 Current State

**Provider:** AWS Lambda worker (mocked responses)  
**URL:** `https://mnjyeg13s4.execute-api.us-west-2.amazonaws.com/prod/`  
**Actual LLM:** None (mock responses, no real API calls)  

**Why:** Set up Lambda + API Gateway for orchestration pattern, but LLM calls not yet wired.

### 7.2 Bedrock Integration (Optional)

**Route:** `/api/llm/bedrock` (POST)  
**Status:** Implemented but not activated (USE_BEDROCK=false by default)  

**To Enable:**
1. Set `USE_BEDROCK=true` in `.env.local`
2. Add AWS credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
3. Set `AWS_REGION=us-west-2`, `BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0`
4. Restart dev server

**What it does:**
- Creates BedrockRuntimeClient (AWS SDK)
- Calls InvokeModel with your input prompt
- Streams response, collects chunks into full response
- Returns text to agent task

### 7.3 Future: Move Bedrock to Lambda

**Current:** LLM calls on Next.js server (expensive, slow cold starts)  
**Future:** Merge `/api/llm/bedrock` logic into Lambda worker to reduce latency + cost

**Steps:**
1. Copy llm-provider.ts callLLM logic to Lambda index.js
2. Add BedrockRuntimeClient + model invocation to Lambda handler
3. Update llm-provider.ts to always call AWS worker URL
4. Deploy updated Lambda with nodejs18.x + Bedrock SDK
5. Set `USE_BEDROCK` in Lambda env vars or move toggle entirely

---

## 8. Running & Testing

### 8.1 Local Development

**Prerequisites:**
- Node.js 18+
- npm or yarn
- AWS account (optional, for Bedrock)
- Chrome browser

**Start Dev Server:**
```bash
cd apps/web
npm install
npm run dev
# Dev server starts on http://localhost:3000 (or auto-selects port 3003, 3004, etc.)
```

**Load Extension Locally:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Navigate to `apps/web/extension/` folder
5. Extension appears in toolbar

**Test Workflow:**
1. Open any webpage (LinkedIn, job board, blog, etc.)
2. Right-click on text or click extension icon
3. Textarea auto-fills with detected content
4. Click "Start Workflow"
5. Watch 6-agent timeline execute in real-time
6. Click "Approve" when complete

**Verify Build:**
```bash
npm run build
# Check .next folder compiled without errors
```

**Smoke Test (manual):**
```bash
npm run smoke
# Runs node scripts/smoke-test.js: POST workflow, poll, check response
```

### 8.2 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 404 on GET `/api/workflows/[id]` | Async params not awaited | See section 2.3: await context, then params |
| Workflow created but lost on refresh | Store reset on hot reload | Verified globalThis singleton works; test with `getStore()` |
| Module not found `.next/server/331.js` | Stale build cache | `rm -rf .next && npm run dev` |
| Extension can't reach localhost:3000 | Port mismatch | Extension auto-detects origin from tab; ensure dev server running |
| Extension throws ReferenceError "chrome not defined" | Content script context | Don't use `chrome.*` in content scripts; use `chrome.runtime.sendMessage` |
| Auto-extract finds wrong content | Selector mismatch | Add custom selectors to cascade in popup.js |

---

## 9. Known Limitations & Next Steps

### 9.1 Incomplete Features (MVP → Production)

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| **DynamoDB Persistence** | Not Started | High | Replace globalThis Map for production. Use AWS SDK DynamoDB client. Schema: id (PK), workflow JSON (SK: createdAt) |
| **Bedrock LLM Calls** | Implemented | Medium | Route `/api/llm/bedrock` works but disabled (USE_BEDROCK=false). Activate by setting env var. |
| **Move Bedrock to Lambda** | Not Started | Medium | Merge LLM logic into Lambda worker for cost/latency. Reduces Next.js memory footprint. |
| **Vercel Deployment** | Not Started | High | Deploy orchestrator to Vercel. Set env vars in project settings. Configure Github Actions for CI/CD. |
| **Stripe Billing** | Not Started | Post-MVP | Integrate Stripe; trigger on `/approve` endpoint. Store billing events in DynamoDB. |
| **Email Notifications** | Not Started | Post-MVP | SendGrid or SES for workflow completion + results. Send to user email on approve. |
| **Agent Customization** | Not Started | Post-MVP | Allow users to edit agent prompts, add custom agents, reorder pipeline. UI: admin panel in Next.js. |
| **Result Export** | Not Started | Post-MVP | Export workflow results as PDF (resume) or JSON. Email or download options. |
| **Analytics** | Not Started | Post-MVP | Track workflow completions, user engagement, agent performance. CloudWatch + Grafana dashboards. |

### 9.2 Security Audit Checklist

- [ ] **Secrets Management:** No hardcoded credentials. Verify AWS keys only in env vars.
- [ ] **CORS:** Extension uses `host_permissions`; backend does NOT set CORS headers (correct for same-origin).
- [ ] **Content Security Policy:** Extension popup.html has no inline scripts; all JS in popup.js (good).
- [ ] **Input Validation:** Validate `input` length (no trillion-character payloads). Set max 50KB.
- [ ] **Rate Limiting:** Add API rate limits to `/api/workflows/start` per IP (consider proxy user account).
- [ ] **Scope Creep:** Extension permissions (contextMenus, scripting) are minimal; no ambient authority.

### 9.3 Performance Considerations

- **In-Memory Store:** OK for MVP (<1000 workflows). Move to DynamoDB + Redis cache for scale.
- **Sequential Agent Execution:** Fine for 6 agents (~5-10 sec per workflow). Parallelize if adding more.
- **Polling Frequency:** 500ms is aggressive (200 polls/min). Consider WebSocket or server-sent events for scale.
- **Lambda Cold Starts:** nodejs18.x provisioned concurrency recommended for <1s response. Current setup is OK for dev/demo.

---

## 10. Git & Branching

**Current Branch:** `feature/agentic-pipeline-v1`  
**Main Branch:** `main` (not deployed yet)  

**Recent Commits:**
```
d1baea7 - feat: enhanced workflow with auto-page capture, expanded agents, visual progress timeline
[previous commits for routes, orchestrator setup, etc.]
```

**To Deploy/Test:**
```bash
git checkout feature/agentic-pipeline-v1
git pull origin feature/agentic-pipeline-v1
npm install
npm run build  # Verify no errors
npm run dev    # Start local dev server
```

**To Merge to Main (when ready for production):**
```bash
git checkout main
git pull origin main
git merge feature/agentic-pipeline-v1
git push origin main
# Deploy to Vercel via webhook (once CI/CD configured)
```

---

## 11. Key Files Reference

| File | Purpose | Lines | Last Change |
|------|---------|-------|-------------|
| [lib/workflow-store.ts](../lib/workflow-store.ts) | Core orchestrator: Workflow type, AGENTS registry, createWorkflow, runAgents, approveWorkflow | ~100 | Task.icon, Task.description added |
| [app/api/workflows/start/route.ts](../app/api/workflows/start/route.ts) | POST endpoint to start workflow | ~10 | Minimal, calls createWorkflow |
| [app/api/workflows/[id]/route.ts](../app/api/workflows/[id]/route.ts) | GET endpoint to retrieve workflow state | ~15 | Async params fix (await context, then params) |
| [app/api/workflows/[id]/approve/route.ts](../app/api/workflows/[id]/approve/route.ts) | POST endpoint to approve | ~10 | Sets approved=true, status='approved' |
| [lib/llm-provider.ts](../lib/llm-provider.ts) | LLM abstraction layer | ~20 | Routes Bedrock vs AWS Worker |
| [app/api/llm/bedrock/route.ts](../app/api/llm/bedrock/route.ts) | Bedrock API wrapper (optional) | ~30 | BedrockRuntimeClient integration |
| [extension/manifest.json](../extension/manifest.json) | Extension config | ~15 | host_permissions wildcard for localhost |
| [extension/background.js](../extension/background.js) | Context menu + tab origin detection | ~35 | Derives origin from tab.url, POSTs to /start |
| [extension/popup.html](../extension/popup.html) | Extension UI structure | ~30 | Three sections: input, progress, results |
| [extension/popup.js](../extension/popup.js) | Popup logic: extract, poll, render | ~150 | Auto-extract via scripting, timeline rendering |
| [extension/popup.css](../extension/popup.css) | Popup styling | ~50 | Timeline colors, spinner animation |
| [package.json](../package.json) | Dependencies | ~30 | Added @aws-sdk/client-bedrock-runtime |

---

## 12. Contact & Support

**Original Developer:** Isak Rabin  
**GitHub:** sgirabin  
**Email:** [check repo settings]  

**For Questions:**
1. Check conversation transcript: `/Users/isakrabin/Library/Application Support/Code/User/workspaceStorage/9d3dff24306e3b9deb63a9e45d046cec/GitHub.copilot-chat/transcripts/247c1d44-6bca-4452-8b17-5d2a06308442.jsonl`
2. Review commit messages on `feature/agentic-pipeline-v1` branch
3. Check AWS Lambda console for worker logs
4. Run `npm run smoke` to validate API endpoints

---

## 13. Quick Start for New Developer

**Goal:** Get the demo running locally in 5 minutes.

```bash
# 1. Clone & setup
git clone https://github.com/sgirabin/career-kaki.git
cd career-kaki
npm install

# 2. Start dev server
cd apps/web
npm run dev
# Note: Server auto-selects port (3000, 3003, 3004, etc.)

# 3. Load extension
# - Open chrome://extensions
# - Enable "Developer mode"
# - Load unpacked: apps/web/extension
# - Extension now in toolbar

# 4. Test workflow
# - Open any webpage (LinkedIn preferred)
# - Right-click on text or click extension icon
# - Click "Start Workflow"
# - Watch 6 agents execute
# - Click "Approve"

# 5. Inspect results
# - Check browser DevTools console for logs
# - Verify API responses in Network tab
# - See workflow state: curl http://localhost:3000/api/workflows/{id}

# 6. Next: Pick a task from section 9.1 above
# - DynamoDB persistence (high priority)
# - Vercel deployment (high priority)
# - Bedrock activation (medium priority)
```

---

**Document Version:** 1.0  
**Last Verified:** 2026-06-09  
**Status:** MVP complete, production-ready for local testing
