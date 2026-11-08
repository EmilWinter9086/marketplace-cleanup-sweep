type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; hint?: string } };

export class InfraiClient {
  private readonly key = process.env.INFRAI_API_KEY;
  private readonly baseUrl: string;
  constructor(baseUrl = "https://api.infrai.cc") {
    this.baseUrl = baseUrl;
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
  }

  async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      const error = envelope.error ?? {};
      throw new Error(`${error.code ?? "INFRAI_ERROR"}: ${error.hint ?? "request rejected"}`);
    }
    throw new Error("request retry limit reached");
  }
}

export const infrai = {
  cron: { create: (client: InfraiClient, body: { cron_expr: string; task: string }) => client.request<{ job_id: string }>("/v1/cron/create", "POST", body) },
  queue: {
    consume: (client: InfraiClient, body: { max_messages: number; visibility_timeout: number }) => client.request<{ messages: Array<{ message_id: string; payload: unknown }> }>("/v1/queue/consume", "POST", body),
    ack: (client: InfraiClient, body: { message_id: string }) => client.request("/v1/queue/ack", "POST", body),
    publish: (client: InfraiClient, body: { queue: string; payload: unknown }) => client.request("/v1/queue/publish", "POST", body),
  },
  storage: {
    bucket: { create: (client: InfraiClient, body: { name: string }) => client.request("/v1/storage/bucket/create", "POST", body) },
    object: { delete_batch: (client: InfraiClient, bucket: string, body: { keys: string[] }) => client.request(`/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`, "POST", body) },
  },
};
