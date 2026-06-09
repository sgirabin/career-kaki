import { randomUUID } from 'crypto';
import { callLLM } from './llm-provider';

type TaskStatus = 'pending' | 'running' | 'done' | 'error';

export type Task = {
  agent: string;
  description: string;
  icon: string;
  status: TaskStatus;
  result?: any;
};

export type Workflow = {
  id: string;
  input: string;
  status: 'running' | 'complete' | 'approved';
  tasks: Task[];
  createdAt: string;
  approved?: boolean;
};

// Agent registry with descriptions and icons
const AGENTS = [
  { agent: 'job-extractor', description: 'Extract job details', icon: '📋' },
  { agent: 'company-researcher', description: 'Research company', icon: '🔍' },
  { agent: 'resume-reader', description: 'Read your resume', icon: '📄' },
  { agent: 'resume-writer', description: 'Build tailored resume', icon: '✍️' },
  { agent: 'role-matcher', description: 'Find similar roles', icon: '🎯' },
  { agent: 'social-composer', description: 'Create LinkedIn post', icon: '💬' },
];

// Use globalThis to persist store across Next.js hot reloads in dev
const getStore = () => {
  if (!(global as any).__workflowStore) {
    (global as any).__workflowStore = new Map<string, Workflow>();
  }
  return (global as any).__workflowStore as Map<string, Workflow>;
};

export function createWorkflow(input: string) {
  const id = randomUUID();
  const tasks: Task[] = AGENTS.map(({ agent, description, icon }) => ({
    agent,
    description,
    icon,
    status: 'pending',
  }));
  const wf: Workflow = { id, input, status: 'running', tasks, createdAt: new Date().toISOString() };
  getStore().set(id, wf);
  runAgents(wf).catch(() => {});
  return wf;
}


export function getWorkflow(id: string) {
  return getStore().get(id) ?? null;
}

async function runAgents(wf: Workflow) {
  const workerUrl = process.env.NEXT_PUBLIC_AWS_WORKER_URL;
  // Run each agent sequentially
  for (let i = 0; i < wf.tasks.length; i++) {
    const task = wf.tasks[i];
    task.status = 'running';
    try {
      const result = await callLLM(wf.input);

      // Agent-specific result shaping
      if (task.agent === 'job-extractor') {
        task.result = { jobTitle: 'Job Title', requirements: ['Req 1', 'Req 2'], raw: result };
      } else if (task.agent === 'company-researcher') {
        task.result = { companyName: 'Company', background: 'Background info', raw: result };
      } else if (task.agent === 'resume-reader') {
        task.result = { skills: ['React', 'Node.js'], experience: '5 years', raw: result };
      } else if (task.agent === 'resume-writer') {
        task.result = { text: `Tailored resume for: ${wf.input}`, raw: result };
      } else if (task.agent === 'role-matcher') {
        task.result = { matches: ['Role A', 'Role B', 'Role C'], raw: result };
      } else if (task.agent === 'social-composer') {
        task.result = { post: `LinkedIn post about ${wf.input}`, raw: result };
      } else {
        task.result = { raw: result };
      }
      task.status = 'done';
    } catch (err) {
      task.status = 'error';
      task.result = { error: String(err) };
    }
  }
  wf.status = 'complete';
  getStore().set(wf.id, wf);
}

export function approveWorkflow(id: string) {
  const wf = getStore().get(id);
  if (!wf) return null;
  wf.approved = true;
  wf.status = 'approved';
  getStore().set(id, wf);
  return wf;
}
