export async function callLLM(prompt: string) {
  // Prefer direct Bedrock route if configured
  const useBedrock = process.env.USE_BEDROCK === '1' || process.env.USE_BEDROCK === 'true';
  if (useBedrock) {
    try {
      const res = await fetch('/api/llm/bedrock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const j = await res.json();
      return j;
    } catch (err) {
      return { error: String(err) };
    }
  }

  // Fallback: call configured worker (existing behavior)
  const workerUrl = process.env.NEXT_PUBLIC_AWS_WORKER_URL;
  if (workerUrl) {
    try {
      const r = await fetch(workerUrl, { method: 'GET' });
      const body = await r.json().catch(() => ({ message: 'invalid-json' }));
      return { fromWorker: body };
    } catch (err) {
      return { error: String(err) };
    }
  }

  return { error: 'no-llm-configured' };
}
