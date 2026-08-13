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
      permissions: [
        "employee:read",
        "employee:write",
        "site:read",
        "site:write",
        "task:write",
        "employeeSiteAssignment:read",
        "employeeSiteAssignment:write",
      ],
    });
    adminToken = seeded.token;
    const admin = authed(ctx.app, adminToken);
    await admin.post("/api/v1/sites", { clientId, siteId: "SITE-A", name: "Site A", timezone: "UTC" });
    await admin.post("/api/v1/sites", { clientId, siteId: "SITE-B", name: "Site B", timezone: "UTC" });
    await admin.post("/api/v1/tasks", { clientId, name: "Cleaner" });
    await admin.post("/api/v1/tasks", { clientId, name: "Security" });
    const employee = await admin.post("/api/v1/employees", { clientId, employeeId: "EMP-1", timezone: "UTC" });
    employeeId = employee.body._id;
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it("assigns, lists, and unassigns an employee to/from a site", async () => {
    const admin = authed(ctx.app, adminToken);

    const rejected = await admin.post(`/api/v1/employees/${employeeId}/sites`, {
      siteId: "UNKNOWN-SITE",
      task: "Cleaner",
    });
    expect(rejected.status).toBe(400); // site FK check

    const assigned = await admin.post(`/api/v1/employees/${employeeId}/sites`, {
      siteId: "SITE-A",
      task: "Cleaner",
      isPrimary: true,
    });
    expect(assigned.status).toBe(201);
    expect(assigned.body.task).toBe("Cleaner");

    const list = await admin.get(`/api/v1/employees/${employeeId}/sites`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].task).toBe("Cleaner");

    const unassigned = await admin.delete(`/api/v1/employees/${employeeId}/sites/SITE-A`);
    expect(unassigned.status).toBe(204);

    const listAfter = await admin.get(`/api/v1/employees/${employeeId}/sites`);
    expect(listAfter.body.items).toHaveLength(0);
  });

  it("requires a task when assigning an employee to a site", async () => {
    const admin = authed(ctx.app, adminToken);
    const rejected = await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-A" });
    expect(rejected.status).toBe(400);
  });

  it("rejects a task that isn't in the client's task catalog", async () => {
    const admin = authed(ctx.app, adminToken);
    const rejected = await admin.post(`/api/v1/employees/${employeeId}/sites`, {
      siteId: "SITE-A",
      task: "Not A Real Task",
    });
    expect(rejected.status).toBe(400);
  });

  it("lets the same employee work a different task at a different site", async () => {
    const admin = authed(ctx.app, adminToken);

    const siteA = await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-A", task: "Cleaner" });
    expect(siteA.status).toBe(201);
    const siteB = await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-B", task: "Security" });
    expect(siteB.status).toBe(201);

    const list = await admin.get(`/api/v1/employees/${employeeId}/sites`);
    const bySite = Object.fromEntries(list.body.items.map((a: { siteId: string; task: string }) => [a.siteId, a.task]));
    expect(bySite["SITE-A"]).toBe("Cleaner");
    expect(bySite["SITE-B"]).toBe("Security");
  });

  it("updates an existing assignment's task", async () => {
    const admin = authed(ctx.app, adminToken);
    await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-A", task: "Cleaner" });

    const updated = await admin.patch(`/api/v1/employees/${employeeId}/sites/SITE-A`, { task: "Security" });
    expect(updated.status).toBe(200);
    expect(updated.body.task).toBe("Security");

    const list = await admin.get(`/api/v1/employees/${employeeId}/sites`);
    expect(list.body.items[0].task).toBe("Security");
  });

  it("rejects updating an assignment's task to one outside the task catalog", async () => {
    const admin = authed(ctx.app, adminToken);
    await admin.post(`/api/v1/employees/${employeeId}/sites`, { siteId: "SITE-A", task: "Cleaner" });

    const rejected = await admin.patch(`/api/v1/employees/${employeeId}/sites/SITE-A`, { task: "Not A Real Task" });
    expect(rejected.status).toBe(400);
  });

  it("404s updating an assignment that doesn't exist", async () => {
    const admin = authed(ctx.app, adminToken);
    const rejected = await admin.patch(`/api/v1/employees/${employeeId}/sites/SITE-A`, { task: "Security" });
    expect(rejected.status).toBe(404);
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

    const withinScope = await manager.post(`/api/v1/employees/${employeeId}/sites`, {
      siteId: "SITE-A",
      task: "Cleaner",
    });
    expect(withinScope.status).toBe(201);

    const outsideScope = await manager.post(`/api/v1/employees/${employeeId}/sites`, {
      siteId: "SITE-B",
      task: "Cleaner",
    });
    expect(outsideScope.status).toBe(403);

    // sanity: the admin (not site-scoped) CAN assign SITE-B
    const adminAssignsB = await admin.post(`/api/v1/employees/${employeeId}/sites`, {
      siteId: "SITE-B",
      task: "Security",
    });
    expect(adminAssignsB.status).toBe(201);
  });
});
