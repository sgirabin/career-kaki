import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section style={{ display: "grid", gap: "1.5rem" }}>
        <div>
          <p style={{ margin: 0, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.82rem" }}>
            CareerKaki Frontend
          </p>
          <h1>Autonomous career workflows, built for speed.</h1>
          <p>
            This Next.js app is the frontend shell for CareerKaki. It is designed to orchestrate Vercel AI workflows, connect with the AWS worker backend, and present user approvals for resume generation, job matching, and career planning.
          </p>
        </div>

        <div style={{ display: "grid", gap: "0.8rem" }}>
          <section>
            <h2>Next steps</h2>
            <ul>
              <li>Connect this UI to the AWS worker endpoint.</li>
              <li>Implement AI workflow state management with the Vercel AI SDK.</li>
              <li>Add authenticated career context using Notion / Exa integration.</li>
            </ul>
          </section>

          <section>
            <h2>Developer commands</h2>
            <pre style={{ background: "#f1f5f9", padding: "1rem", borderRadius: "0.75rem", overflowX: "auto" }}>
              <code>npm install{`\n`}npm run dev</code>
            </pre>
          </section>

          <section>
            <Link href="/api/hello" style={{ color: "#0f172a", textDecoration: "none", fontWeight: "600" }}>
              API health check →
            </Link>
          </section>
        </div>
      </section>
    </main>
  );
}
