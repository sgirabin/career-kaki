"use client";

import { useState } from "react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wfId, setWfId] = useState<string | null>(null);
  const [wfState, setWfState] = useState<any | null>(null);
  const [inputText, setInputText] = useState('Experienced frontend engineer with React and Node.js');

  async function callWorker() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/worker");
      const body = await response.json();
      if (!response.ok) {
        setError(JSON.stringify(body, null, 2));
      } else {
        setResult(JSON.stringify(body, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function startWorkflow() {
    setLoading(true);
    setWfId(null);
    setWfState(null);
    try {
      const res = await fetch('/api/workflows/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inputText }) });
      const body = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(body));
      setWfId(body.id);
      pollWorkflow(body.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function pollWorkflow(id: string) {
    setWfState(null);
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/workflows/${id}`);
        const j = await r.json();
        setWfState(j);
        if (j.status === 'complete' || j.status === 'approved') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 800);
  }

  async function approveWorkflow() {
    if (!wfId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/workflows/${wfId}/approve`, { method: 'POST' });
      const j = await r.json();
      setWfState(j);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1>CareerKaki</h1>
      <p>Call the AWS worker backend and see the result below.</p>
      <button
        type="button"
        onClick={callWorker}
        disabled={loading}
        style={{
          padding: "0.75rem 1.25rem",
          borderRadius: 12,
          border: "none",
          background: "#0f172a",
          color: "white",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "1rem",
        }}
      >
        {loading ? "Calling worker..." : "Call AWS worker"}
      </button>

      <section style={{ marginTop: 32 }}>
        <h2>Agentic demo (start workflow)</h2>
        <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={startWorkflow} disabled={loading} style={{ padding: '0.5rem 1rem' }}>Start workflow</button>
          <button onClick={() => { if (wfId) navigator.clipboard.writeText(wfId); }} disabled={!wfId}>Copy workflow id</button>
          <button onClick={approveWorkflow} disabled={!wfId || loading}>Approve</button>
        </div>

        {wfId ? <p style={{ marginTop: 12 }}>Workflow id: <strong>{wfId}</strong></p> : null}

        {wfState ? (
          <div style={{ marginTop: 12 }}>
            <pre style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>{JSON.stringify(wfState, null, 2)}</pre>
          </div>
        ) : null}
      </section>

      {error ? (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            background: "#fee2e2",
            color: "#991b1b",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </pre>
      ) : null}

      {result ? (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            background: "#f8fafc",
            color: "#0f172a",
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </pre>
      ) : null}
    </main>
  );
}
