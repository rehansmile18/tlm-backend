import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, newClientId, TestContext } from "./helpers";

describe("Schedule module", () => {
  let ctx: TestContext;
  let clientId: string;
  let adminToken: string;

  beforeEach(async () => {
    ctx = await setupTestContext();
    clientId = newClientId();
    const seeded = seedAuthedUser({
      role: "CLIENT_ADMIN",
      clientId,
      permissions: [
        "employee:read",
        "employee:write",
        "site:write",
        "employeeSiteAssignment:read",
        "employeeSiteAssignment:write",
        "schedule:read",
        "schedule:write",
        "punch:write",
      ],
    });
    adminToken = seeded.token;
    const admin = authed(ctx.app, adminToken);
    await admin.post("/api/v1/employees", { clientId, employeeId: "EMP-1", timezone: "America/New_York" });
    await admin.post("/api/v1/sites", { clientId, siteId: "SITE-1", name: "Site", timezone: "America/New_York" });
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  async function assignEmployeeToSite(admin: ReturnType<typeof authed>) {
    const employees = await admin.get("/api/v1/employees");
    const employeeMongoId = employees.body.items[0]._id;
    await admin.post(`/api/v1/employees/${employeeMongoId}/sites`, { siteId: "SITE-1" });
  }

  it("rejects a shift for an employee/site pair with no active EmployeeSiteAssignment", async () => {
    const admin = authed(ctx.app, adminToken);
    const res = await admin.post("/api/v1/schedules", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      shiftStart: "2026-07-20T09:00:00.000Z",
      shiftEnd: "2026-07-20T17:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(res.status).toBe(400);
  });

  it("creates a shift, rejects an overlapping one, allows a non-overlapping one, and cancels it", async () => {
    const admin = authed(ctx.app, adminToken);
    await assignEmployeeToSite(admin);

    const created = await admin.post("/api/v1/schedules", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      shiftStart: "2026-07-20T09:00:00.000Z",
      shiftEnd: "2026-07-20T17:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(created.status).toBe(201);
    expect(created.body.businessDate).toBe("2026-07-20");

    const overlapping = await admin.post("/api/v1/schedules", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      shiftStart: "2026-07-20T12:00:00.000Z",
      shiftEnd: "2026-07-20T20:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(overlapping.status).toBe(409);

    const nextDay = await admin.post("/api/v1/schedules", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      shiftStart: "2026-07-21T09:00:00.000Z",
      shiftEnd: "2026-07-21T17:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(nextDay.status).toBe(201);

    const cancelled = await admin.post(`/api/v1/schedules/${created.body._id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");

    // now the originally-overlapping window is free since the first shift is cancelled
    const nowAllowed = await admin.post("/api/v1/schedules", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      shiftStart: "2026-07-20T12:00:00.000Z",
      shiftEnd: "2026-07-20T20:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(nowAllowed.status).toBe(201);
  });

  it("bulk-creates shifts sharing one seriesId with partial rejection, and reports adherence", async () => {
    const admin = authed(ctx.app, adminToken);
    await assignEmployeeToSite(admin);

    const bulk = await admin.post("/api/v1/schedules/bulk", {
      shifts: [
        { clientId, employeeId: "EMP-1", siteId: "SITE-1", shiftStart: "2026-07-20T09:00:00.000Z", shiftEnd: "2026-07-20T17:00:00.000Z", timezone: "America/New_York" },
        { clientId, employeeId: "EMP-1", siteId: "SITE-1", shiftStart: "2026-07-20T12:00:00.000Z", shiftEnd: "2026-07-20T20:00:00.000Z", timezone: "America/New_York" },
      ],
    });
    expect(bulk.status).toBe(207);
    expect(bulk.body.accepted).toHaveLength(1);
    expect(bulk.body.rejected).toHaveLength(1);
    expect(bulk.body.accepted[0].seriesId).toBe(bulk.body.seriesId);

    await admin.post("/api/v1/punches", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      task: "Cashier",
      clockIn: "2026-07-20T09:10:00.000Z",
      clockOut: "2026-07-20T17:00:00.000Z",
      timezone: "America/New_York",
    });

    const adherence = await admin.get(
      "/api/v1/schedules/adherence?from=2026-07-19T00:00:00.000Z&to=2026-07-22T00:00:00.000Z"
    );
    expect(adherence.status).toBe(200);
    expect(adherence.body.items).toHaveLength(1);
    expect(adherence.body.items[0].status).toBe("late"); // clocked in 10 min after shiftStart
  });

  it("rejects a SITE_MANAGER creating a shift outside their own managed sites (scope-denied)", async () => {
    const admin = authed(ctx.app, adminToken);
    await assignEmployeeToSite(admin);

    const { token: managerToken } = seedAuthedUser({
      role: "SITE_MANAGER",
      clientId,
      siteIds: ["SITE-OTHER"],
      permissions: ["schedule:read", "schedule:write"],
    });
    const manager = authed(ctx.app, managerToken);

    const res = await manager.post("/api/v1/schedules", {
      clientId,
      employeeId: "EMP-1",
      siteId: "SITE-1",
      shiftStart: "2026-07-20T09:00:00.000Z",
      shiftEnd: "2026-07-20T17:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(res.status).toBe(403);
  });
});
