import { NextResponse } from 'next/server';
import { createWorkflow } from '../../../../lib/workflow-store';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = body.input || body.text || 'No input provided';
    const wf = createWorkflow(String(input));
    return NextResponse.json({ id: wf.id, status: wf.status }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
