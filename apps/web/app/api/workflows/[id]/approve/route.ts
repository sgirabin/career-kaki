import { NextResponse } from 'next/server';
import { approveWorkflow, getWorkflow } from '../../../../../lib/workflow-store';

export async function POST(request: Request, context: any) {
  const { params } = await context;
  const id = params?.id;
  const wf = getWorkflow(id);
  if (!wf) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const approved = approveWorkflow(id);
  return NextResponse.json(approved);
}
