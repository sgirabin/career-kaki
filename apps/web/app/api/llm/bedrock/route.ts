import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = body.prompt || body.input || '';
  if (!prompt) return NextResponse.json({ error: 'no prompt' }, { status: 400 });

  const modelId = process.env.BEDROCK_MODEL_ID;
  const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2';
  if (!modelId) return NextResponse.json({ error: 'BEDROCK_MODEL_ID not configured' }, { status: 500 });

  try {
    const client = new BedrockRuntimeClient({ region });
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ input: prompt })
    });

    const resp = await client.send(command);
    // resp.body is a stream — collect into string
    let text = '';
    const stream = resp.body as any;
    if (stream) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
      }
      text = Buffer.concat(chunks).toString('utf8');
    }

    // Try parse JSON
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({ ok: true, modelId, result: parsed });
    } catch {
      return NextResponse.json({ ok: true, modelId, result: text });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
