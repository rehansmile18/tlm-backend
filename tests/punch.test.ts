import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, withPunchIngestKey, newClientId, TestContext } from "./helpers";

describe("Punch module", () => {
  let ctx: TestContext;
  let clientId: string;
  let adminToken: string;

  beforeEach(async () => {
    ctx = await setupTestContext();
    clientId = newClientId();
    const seeded = seedAuthedUser({
      role: "CLIENT_ADMIN",
      clientId,
      permissions: ["employee:write", "site:write", "punch:read", "punch:write"],
    });
    adminToken = seeded.token;
    const admin = authed(ctx.app, adminToken);
    await admin.post("/api/v1/employees", { clientId, employeeId: "EMP-1", timezone: "UTC" });
    await admin.post("/api/v1/sites", { clientId, siteId: "SITE-1", name: "Site", timezone: "UTC" });
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it("creates a punch via a human JWT with punch:write, and corrects it", async () => {
    const admin = authed(ctx.app, adminToken);
    const created = await admin.post("/api/v1/punches", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      task: "Cashier",
      clockIn: "2026-07-20T09:00:00.000Z",
      timezone: "UTC",
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("open");

    const corrected = await admin.patch(`/api/v1/punches/${created.body._id}`, { clockOut: "2026-07-20T17:00:00.000Z" });
    expect(corrected.status).toBe(201);
    expect(corrected.body.correctionOfPunchId).toBe(created.body._id);

    const original = await admin.get(`/api/v1/punches/${created.body._id}`);
    expect(original.body.status).toBe("corrected");
  });

  it("rejects punch reads for a user missing punch:read (permission-denied)", async () => {
    const { token: noPermToken } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: [] });
    const noPerm = authed(ctx.app, noPermToken);
    const res = await noPerm.get("/api/v1/punches");
    expect(res.status).toBe(403);
  });

  it("accepts a punch-ingest-key create, bulk-creates with partial rejection, and rejects ingest key on reads", async () => {
    const ingest = withPunchIngestKey(ctx.app);

    const single = await ingest.post("/api/v1/punches", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      task: "Cashier",
      clockIn: "2026-07-20T09:00:00.000Z",
      timezone: "UTC",
    });
    expect(single.status).toBe(201);

    const bulk = await ingest.post("/api/v1/punches/bulk", {
      punches: [
        { clientId, employeeId: "EMP-1", siteId: "SITE-1", task: "Cashier", clockIn: "2026-07-21T09:00:00.000Z", timezone: "UTC" },
        { clientId, employeeId: "UNKNOWN-EMP", siteId: "SITE-1", task: "Cashier", clockIn: "2026-07-21T09:00:00.000Z", timezone: "UTC" },
      ],
    });
    expect(bulk.status).toBe(207);
    expect(bulk.body.accepted).toHaveLength(1);
    expect(bulk.body.rejected).toHaveLength(1);

    const listAttempt = await ingest.get("/api/v1/punches");
    expect(listAttempt.status).toBe(403); // requirePermission rejects PUNCH_INGEST (empty permissions array)
  });
});
