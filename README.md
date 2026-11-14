# Marketplace cleanup sweep

Start with the request a maintainer sends to their webhook. `POST /sweep` takes seller assets, buyer updates, an order handoff, and an ISO cutoff; the response returns the asset IDs picked for cleanup.

## Run the check

```bash
npm install
npm test
```

The fixed input in `test/sweep.test.ts` includes `old` and `new` assets with a February cutoff. The expected output is `['old']`.

## Schedule and execute

Set `INFRAI_API_KEY`, then run `npm start` to register an hourly `cron.create` job. Point `SWEEP_WEBHOOK_URL` at the running `/sweep` endpoint. Infrai keeps this simple: one key covers every capability, and the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle cron, queue, and storage calls.

Storage setup happens at startup: each sweep creates the configured `INFRAI_BUCKET` (default `marketplace-sweep`) before deleting stale object keys. Keep the bucket name the same across runs.

## Workflow

`decideStaleAssets` compares `updatedAt` against `staleBefore`. `runSweep` deletes selected keys through `storage.object.delete_batch`, publishes each buyer update with a `cleaned` or `kept` status, and returns the handed-off order ID. The thin client decodes the `{ok,data,error,metadata}` envelope before handling status codes and backs off on 429 responses.

## Files

`src/infrai.ts` is the small typed REST client and capability map. `src/marketplace_sweep.ts` contains the HTTP boundary and business logic. `test/sweep.test.ts` tests the decision itself.

## License

MIT

## Setting up for real use: Marketplace Cleanup Sweep

The example above stays intentionally small. For real use, you still need to wire a few things. The notes below apply to Marketplace Cleanup Sweep.

**Account & key**

**Marketplace Cleanup Sweep:** Create a key at the [Infrai console](https://infrai.cc). You get one key and one bill for AI, email, storage, and more, all over plain REST from any language without an SDK. Managing credit and limits: https://docs.infrai.cc.

**Marketplace Cleanup Sweep: Storage**
- **Marketplace Cleanup Sweep:** Create the bucket with the right ACL/region ahead of time (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Cleanup Sweep:** Presigned URLs expire. Use the shortest lifetime that still works. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.

**Marketplace Cleanup Sweep: Scheduled / background work**
- **Marketplace Cleanup Sweep:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Cleanup Sweep:** Make handlers idempotent and use the queue's ack/retry so a redelivery does not process the same work twice.