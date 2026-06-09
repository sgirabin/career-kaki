# CareerKaki Architecture (AWS Native Upgrade)

CareerKaki is an autonomous, multi-agent career enablement engine built natively on AWS Agentic Infrastructure and deployed via Vercel.

## 🏗️ Core System Topology

1. Frontend & Orchestrator (Vercel): Next.js App using Vercel AI SDK Workflows for state handling and human-in-the-loop approvals.
2. Context Brain (Notion API): Supplies user work history and career tracking logs.
3. Live Web Intel (Exa API): Conducts initial deep structural internet search.
4. Autonomous Execution Layer (AWS Compute & AI):
   - AWS Lambda: Acts as the entry router for backend orchestration.
   - Amazon Bedrock (Claude Sonnet 4.6): Core LLM brain generating tailored resumes and social posts.
   - Amazon DynamoDB: Persists application states, drafts, and approval history.