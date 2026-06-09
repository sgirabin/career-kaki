import { NextResponse } from 'next/server';
import { getWorkflow } from '../../../../lib/workflow-store';

export async function GET(request: Request, context: any) {
  const { params: paramsPromise } = await context;
  const { id } = await paramsPromise;
  const wf = getWorkflow(id);
  if (!wf) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(wf);
}
