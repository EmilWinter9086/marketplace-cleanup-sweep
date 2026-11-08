import { createServer } from "node:http";
import { z } from "zod";
import { InfraiClient, infrai } from "./infrai.js";

const requestSchema = z.object({
  sellerAssets: z.array(z.object({ id: z.string(), updatedAt: z.string() })),
  buyerUpdates: z.array(z.object({ buyerId: z.string(), orderId: z.string() })),
  orderHandoff: z.object({ orderId: z.string(), handedOffAt: z.string() }),
  staleBefore: z.string(),
});
export type SweepRequest = z.infer<typeof requestSchema>;

export function decideStaleAssets(input: SweepRequest): string[] {
  const cutoff = Date.parse(input.staleBefore);
  return input.sellerAssets.filter((asset) => Date.parse(asset.updatedAt) < cutoff).map((asset) => asset.id);
}

export async function runSweep(input: SweepRequest, client: InfraiClient, bucket: string) {
  const stale = decideStaleAssets(input);
  if (stale.length) await infrai.storage.object.delete_batch(client, bucket, { keys: stale });
  for (const update of input.buyerUpdates) {
    await infrai.queue.publish(client, { queue: process.env.INFRAI_QUEUE ?? "marketplace-sweep", payload: { ...update, status: stale.includes(update.orderId) ? "cleaned" : "kept" } });
  }
  return { staleAssetIds: stale, handedOffOrder: input.orderHandoff.orderId };
}

async function main() {
  const client = new InfraiClient();
  await infrai.storage.bucket.create(client, { name: process.env.INFRAI_BUCKET ?? "marketplace-sweep" });
  const job = await infrai.cron.create(client, { cron_expr: "0 * * * *", task: process.env.SWEEP_WEBHOOK_URL ?? "https://example.com/sweep" });
  console.log(`scheduled ${job.job_id}`);
  serve();
}

if (process.argv[1]?.endsWith("marketplace_sweep.ts")) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

export function serve(port = Number(process.env.PORT ?? 3000)) {
  const client = new InfraiClient();
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/sweep") { res.writeHead(404).end(); return; }
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = requestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      const result = await runSweep(body, client, process.env.INFRAI_BUCKET ?? "marketplace-sweep");
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    } catch (error) { res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: String(error) })); }
  });
  server.listen(port); return server;
}
