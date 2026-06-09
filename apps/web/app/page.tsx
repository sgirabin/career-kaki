"use client";

import { useState } from "react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
