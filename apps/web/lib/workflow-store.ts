import { randomUUID } from 'crypto';

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

const store = new Map<string, Workflow>();

export function createWorkflow(input: string) {
  const id = randomUUID();
  const tasks: Task[] = [
    { agent: 'resume-writer', status: 'pending' },
    { agent: 'role-matcher', status: 'pending' },
    { agent: 'social-composer', status: 'pending' },
  ];
  const wf: Workflow = { id, input, status: 'running', tasks, createdAt: new Date().toISOString() };
  store.set(id, wf);
  runAgents(wf).catch(() => {});
  return wf;
}

export function getWorkflow(id: string) {
  return store.get(id) ?? null;
}

async function runAgents(wf: Workflow) {
  const workerUrl = process.env.NEXT_PUBLIC_AWS_WORKER_URL;
  // Run each agent sequentially (fast) — could be parallel if desired
  for (let i = 0; i < wf.tasks.length; i++) {
    const task = wf.tasks[i];
    task.status = 'running';
    try {
      let result: any = { message: 'no-worker' };
      if (workerUrl) {
        try {
          const res = await fetch(workerUrl, { method: 'GET' });
          const body = await res.json().catch(() => ({ message: 'invalid-json' }));
          result = { fromWorker: body };
        } catch (err) {
          result = { error: String(err) };
        }
      } else {
        result = { message: 'worker not configured' };
      }

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
  store.set(wf.id, wf);
}

export function approveWorkflow(id: string) {
  const wf = store.get(id);
  if (!wf) return null;
  wf.approved = true;
  wf.status = 'approved';
  store.set(id, wf);
  return wf;
}
