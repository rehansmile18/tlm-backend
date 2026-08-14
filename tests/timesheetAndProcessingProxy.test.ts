import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, newClientId, TestContext } from "./helpers";
import {
  setMockTimesheetByIdHandler,
  setMockProcessingRunHandler,
  setMockVoidTimesheetHandler,
  setMockTimesheetSiteGroupsHandler,
  setMockTimesheetGridHandler,
} from "./mockUpstreams";

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

      // A well-formed (but non-existent) ObjectId — the route validates the id's shape before
      // this mock upstream is ever reached, so a placeholder like "abc123" would 400 first.
      const res = await client.get(`/api/v1/timesheets/${newClientId()}`);
      expect(res.status).toBe(200);
      expect(res.body.totalHours).toBe(40);
    });

    it("rejects fetching another client's timesheet (scope-denied)", async () => {
      const clientId = newClientId();
      const otherClientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetByIdHandler((id) => ({ _id: id, clientId: otherClientId, status: "completed" }));

      const res = await client.get(`/api/v1/timesheets/${newClientId()}`);
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

      const timesheetId = newClientId();
      const deniedForMissingPermission = await client.post(`/api/v1/timesheets/${timesheetId}/void`, { reason: "duplicate" });
      expect(deniedForMissingPermission.status).toBe(403);

      const { token: voidToken } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read", "timesheet:void"] });
      const voider = authed(ctx.app, voidToken);
      const voided = await voider.post(`/api/v1/timesheets/${timesheetId}/void`, { reason: "duplicate" });
      expect(voided.status).toBe(200);
      expect(voided.body.status).toBe("voided");
    });
  });

  describe("timesheetProxy - site-grouped views", () => {
    it("lists site groups for the caller's own client", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetSiteGroupsHandler(() => ({
        items: [{ siteId: "site-a", payPeriodId: "W-abc-2026-08-03", employeeCount: 3, totalHours: 96, totalAmount: 1920 }],
        total: 1,
        page: 1,
        pageSize: 50,
      }));

      const res = await client.get("/api/v1/timesheets/by-site");
      expect(res.status).toBe(200);
      expect(res.body.items[0].siteId).toBe("site-a");
    });

    it("rejects a caller missing timesheet:read (permission-denied)", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: [] });
      const client = authed(ctx.app, token);

      const res = await client.get("/api/v1/timesheets/by-site");
      expect(res.status).toBe(403);
    });

    it("forwards a SITE_MANAGER's own managed sites as an allow-list when no explicit siteId is given", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({
        role: "SITE_MANAGER",
        clientId,
        siteIds: ["site-a", "site-b"],
        permissions: ["timesheet:read"],
      });
      const client = authed(ctx.app, token);

      let capturedSiteIds: string | null = null;
      setMockTimesheetSiteGroupsHandler((query) => {
        capturedSiteIds = query.get("siteIds");
        return { items: [], total: 0, page: 1, pageSize: 50 };
      });

      const res = await client.get("/api/v1/timesheets/by-site");
      expect(res.status).toBe(200);
      expect(capturedSiteIds).toBe("site-a,site-b");
    });

    it("rejects a SITE_MANAGER explicitly requesting a site outside their managed sites (scope-denied)", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({
        role: "SITE_MANAGER",
        clientId,
        siteIds: ["site-a"],
        permissions: ["timesheet:read"],
      });
      const client = authed(ctx.app, token);

      const res = await client.get("/api/v1/timesheets/by-site?siteId=site-outside-scope");
      expect(res.status).toBe(403);
    });

    it("returns a site+period grid for the caller's own client", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetGridHandler((siteId, payPeriodId) => ({
        siteId,
        payPeriodId,
        dates: ["2026-08-03", "2026-08-04"],
        rows: [{ employeeId: "emp-1", timesheetId: newClientId(), totalHours: 16, cellsByDate: {} }],
        totals: { employeeCount: 1, totalHours: 16, totalAmount: 320 },
      }));

      const res = await client.get("/api/v1/timesheets/by-site/site-a/W-abc-2026-08-03");
      expect(res.status).toBe(200);
      expect(res.body.siteId).toBe("site-a");
      expect(res.body.rows).toHaveLength(1);
    });

    it("rejects a SITE_MANAGER requesting a grid outside their managed sites (scope-denied)", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({
        role: "SITE_MANAGER",
        clientId,
        siteIds: ["site-a"],
        permissions: ["timesheet:read"],
      });
      const client = authed(ctx.app, token);

      const res = await client.get("/api/v1/timesheets/by-site/site-outside-scope/W-abc-2026-08-03");
      expect(res.status).toBe(403);
    });

    it("404s when the grid has no matching timesheets", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["timesheet:read"] });
      const client = authed(ctx.app, token);

      setMockTimesheetGridHandler(() => null);

      const res = await client.get("/api/v1/timesheets/by-site/no-such-site/no-such-period");
      expect(res.status).toBe(404);
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
