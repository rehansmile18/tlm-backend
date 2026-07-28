import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, newClientId, TestContext } from "./helpers";

describe("EmployeeSiteAssignment module", () => {
  let ctx: TestContext;
  let clientId: string;
  let adminToken: string;
  let employeeId: string;

  beforeEach(async () => {
    ctx = await setupTestContext();
    clientId = newClientId();
    const seeded = seedAuthedUser({
      role: "CLIENT_ADMIN",
      clientId,
      permissions: ["employee:read", "employee:write", "site:read", "site:write", "employeeSiteAssignment:read", "employeeSiteAssignment:write"],
    });
    adminToken = seeded.token;
    const admin = authed(ctx.app, adminToken);
    await admin.post("/api/v1/sites", { clientId, siteId: "SITE-A", name: "Site A", timezone: "UTC" });
    await admin.post("/api/v1/sites", { clientId, siteId: "SITE-B", name: "Site B", timezone: "UTC" });
    const employee = await admin.post("/api/v1/employees", { clientId, employeeId: "EMP-1", timezone: "UTC" });
    employeeId = employee.body._id;
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it("assigns, lists, and unassigns an employee to/from a site", async () => {
    const admin = authed(ctx.app, adminToken);

    const rejected = await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "UNKNOWN-SITE" });
    expect(rejected.status).toBe(400); // site FK check

    const assigned = await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-A", isPrimary: true });
    expect(assigned.status).toBe(201);

    const list = await admin.get(`/api/v1/employees/${employeeId}/sites`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);

    const unassigned = await admin.delete(`/api/v1/employees/${employeeId}/sites/SITE-A`);
    expect(unassigned.status).toBe(204);

    const listAfter = await admin.get(`/api/v1/employees/${employeeId}/sites`);
    expect(listAfter.body.items).toHaveLength(0);
  });

  it("rejects a SITE_MANAGER assigning a site outside their own managed sites (scope-denied)", async () => {
    const admin = authed(ctx.app, adminToken);
    const { token: managerToken } = seedAuthedUser({
      role: "SITE_MANAGER",
      clientId,
      siteIds: ["SITE-A"],
      permissions: ["employeeSiteAssignment:read", "employeeSiteAssignment:write"],
    });
    const manager = authed(ctx.app, managerToken);

    const withinScope = await manager.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-A" });
    expect(withinScope.status).toBe(201);

    const outsideScope = await manager.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-B" });
    expect(outsideScope.status).toBe(403);

    // sanity: the admin (not site-scoped) CAN assign SITE-B
    const adminAssignsB = await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-B" });
    expect(adminAssignsB.status).toBe(201);
  });
});
