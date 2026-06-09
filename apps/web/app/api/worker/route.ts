import { NextResponse } from "next/server";

export async function GET() {
  const workerUrl = process.env.NEXT_PUBLIC_AWS_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_AWS_WORKER_URL is not configured." }, { status: 500 });
  }

  try {
    const res = await fetch(workerUrl, { method: "GET" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
