import assert from "node:assert/strict";
import { decideStaleAssets } from "../src/marketplace_sweep.js";
const result = decideStaleAssets({ sellerAssets: [{ id: "old", updatedAt: "2025-01-01T00:00:00Z" }, { id: "new", updatedAt: "2025-03-01T00:00:00Z" }], buyerUpdates: [], orderHandoff: { orderId: "o1", handedOffAt: "2025-03-01T00:00:00Z" }, staleBefore: "2025-02-01T00:00:00Z" });
assert.deepEqual(result, ["old"]);
console.log("sweep decision test passed");
