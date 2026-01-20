import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  try {
    const { messageId } = await req.json().catch(() => ({}));
    if (!messageId) return json(400, { ok: false, field: "messageId", message: "Missing messageId" });

    const SEMAPHORE_API_KEY = (Deno.env.get("SEMAPHORE_API_KEY") || "").trim();
    if (!SEMAPHORE_API_KEY) return json(500, { ok: false, message: "Server not configured (Semaphore key)." });

    const url = `https://api.semaphore.co/api/v4/messages/${encodeURIComponent(
      String(messageId)
    )}?apikey=${encodeURIComponent(SEMAPHORE_API_KEY)}`;

    const resp = await fetch(url, { method: "GET" });
    const rawText = await resp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }

    if (!resp.ok) {
      return json(502, { ok: false, message: `Semaphore error (HTTP ${resp.status}).`, details: parsed });
    }

    // parsed is a single message object per docs
    return json(200, {
      ok: true,
      message: parsed,
      status: parsed?.status ?? null,
      network: parsed?.network ?? null,
      recipient: parsed?.recipient ?? null,
      updated_at: parsed?.updated_at ?? null,
    });
  } catch (e) {
    return json(500, { ok: false, message: e?.message || "Server error" });
  }
});
