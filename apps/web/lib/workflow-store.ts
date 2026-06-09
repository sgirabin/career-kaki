import { randomUUID } from 'crypto';
import { callLLM } from './llm-provider';

type TaskStatus = 'pending' | 'running' | 'done' | 'error';

export type Task = {
  agent: string;
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

// Use globalThis to persist store across Next.js hot reloads in dev
const getStore = () => {
  if (!(global as any).__workflowStore) {
    (global as any).__workflowStore = new Map<string, Workflow>();
  }
  return (global as any).__workflowStore as Map<string, Workflow>;
};

export function createWorkflow(input: string) {
  const id = randomUUID();
  const tasks: Task[] = [
    { agent: 'resume-writer', status: 'pending' },
    { agent: 'role-matcher', status: 'pending' },
    { agent: 'social-composer', status: 'pending' },
  ];
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
  // Run each agent sequentially (fast) — could be parallel if desired
  for (let i = 0; i < wf.tasks.length; i++) {
    const task = wf.tasks[i];
    task.status = 'running';
    try {
      const result = await callLLM(wf.input);

      // Minimal agent-specific shaping
      if (task.agent === 'resume-writer') {
        task.result = { text: `Resume draft for input: ${wf.input}`, raw: result };
      } else if (task.agent === 'role-matcher') {
        task.result = { matches: [`Role A for ${wf.input}`, `Role B for ${wf.input}`], raw: result };
      } else if (task.agent === 'social-composer') {
        task.result = { post: `Short LinkedIn post about ${wf.input}`, raw: result };
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
