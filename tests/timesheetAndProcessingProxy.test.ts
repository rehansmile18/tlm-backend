import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, newClientId, TestContext } from "./helpers";
import { setMockTimesheetByIdHandler, setMockProcessingRunHandler, setMockVoidTimesheetHandler } from "./mockUpstreams";

describe("Timesheet-proxy and processing-trigger-proxy modules", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTestContext();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  describe("timesheetProxy", () => {
    it("fetches a timesheet belonging to the caller's own client", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetByIdHandler((id) => ({ _id: id, clientId, status: "completed", totalHours: 40 }));

      const res = await client.get("/api/v1/timesheets/abc123");
      expect(res.status).toBe(200);
      expect(res.body.totalHours).toBe(40);
    });

    it("rejects fetching another client's timesheet (scope-denied)", async () => {
      const clientId = newClientId();
      const otherClientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetByIdHandler((id) => ({ _id: id, clientId: otherClientId, status: "completed" }));

      const res = await client.get("/api/v1/timesheets/abc123");
      expect(res.status).toBe(403);
    });

    it("rejects a read for a user missing timesheet:read (permission-denied)", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: [] });
      const client = authed(ctx.app, token);

      const res = await client.get("/api/v1/timesheets");
      expect(res.status).toBe(403);
    });

    it("voids a timesheet belonging to the caller's own client, and rejects without timesheet:void", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetByIdHandler((id) => ({ _id: id, clientId, status: "completed" }));
      setMockVoidTimesheetHandler((id, reason) => ({ _id: id, status: "voided", reason }));

      const deniedForMissingPermission = await client.post("/api/v1/timesheets/abc123/void", { reason: "duplicate" });
      expect(deniedForMissingPermission.status).toBe(403);

      const { token: voidToken } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read", "timesheet:void"] });
      const voider = authed(ctx.app, voidToken);
      const voided = await voider.post("/api/v1/timesheets/abc123/void", { reason: "duplicate" });
      expect(voided.status).toBe(200);
      expect(voided.body.status).toBe("voided");
    });
  });

  describe("processingProxy", () => {
    it("triggers processing for the caller's own client", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["processing:trigger"] });
      const client = authed(ctx.app, token);

      setMockProcessingRunHandler((body) => ({
        summary: { completed: 1, skippedLocked: 0, failed: 0 },
        items: [{ employeeId: (body as { employeeIds: string[] }).employeeIds[0], status: "completed" }],
      }));

      const res = await client.post("/api/v1/processing/runs", { clientId, employeeIds: ["EMP-1"], asOfDate: "2026-07-20" });
      expect(res.status).toBe(207);
      expect(res.body.summary.completed).toBe(1);
    });

    it("rejects a caller missing processing:trigger (permission-denied)", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: [] });
      const client = authed(ctx.app, token);

      const res = await client.post("/api/v1/processing/runs", { clientId, employeeIds: ["EMP-1"], asOfDate: "2026-07-20" });
      expect(res.status).toBe(403);
    });

    it("rejects triggering processing for another client (scope-denied)", async () => {
      const clientId = newClientId();
      const otherClientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["processing:trigger"] });
      const client = authed(ctx.app, token);

      const res = await client.post("/api/v1/processing/runs", { clientId: otherClientId, employeeIds: ["EMP-1"], asOfDate: "2026-07-20" });
      expect(res.status).toBe(403);
    });
  });
});
