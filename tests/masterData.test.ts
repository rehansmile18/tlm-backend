import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, newClientId, TestContext } from "./helpers";

describe("master data modules", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTestContext();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  describe("Employee", () => {
    it("creates, lists, gets, and updates an employee for an authorized CLIENT_ADMIN", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["employee:read", "employee:write"] });
      const client = authed(ctx.app, token);

      const created = await client.post("/api/v1/employees", {
        clientId,
        employeeId: "E-1",
        timezone: "America/Los_Angeles",
      });
      expect(created.status).toBe(201);
      expect(created.body.employeeId).toBe("E-1");

      const list = await client.get("/api/v1/employees");
      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);

      const got = await client.get(`/api/v1/employees/${created.body._id}`);
      expect(got.status).toBe(200);

      const updated = await client.patch(`/api/v1/employees/${created.body._id}`, { status: "inactive" });
      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe("inactive");
    });

    it("rejects create for a user missing employee:write (permission-denied)", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["employee:read"] });
      const client = authed(ctx.app, token);

      const res = await client.post("/api/v1/employees", { clientId, employeeId: "E-1", timezone: "UTC" });
      expect(res.status).toBe(403);
    });

    it("rejects create for another client's clientId (scope-denied) and hides that client's data from reads", async () => {
      const ownClientId = newClientId();
      const otherClientId = newClientId();
      const { token: ownToken } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId: ownClientId, permissions: ["employee:read", "employee:write"] });
      const { token: otherToken } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId: otherClientId, permissions: ["employee:read", "employee:write"] });
      const own = authed(ctx.app, ownToken);
      const other = authed(ctx.app, otherToken);

      const crossClientAttempt = await own.post("/api/v1/employees", { clientId: otherClientId, employeeId: "E-1", timezone: "UTC" });
      expect(crossClientAttempt.status).toBe(403);

      const created = await other.post("/api/v1/employees", { clientId: otherClientId, employeeId: "E-2", timezone: "UTC" });
      expect(created.status).toBe(201);

      const ownList = await own.get("/api/v1/employees");
      expect(ownList.body.total).toBe(0);

      const ownGetOtherEmployee = await own.get(`/api/v1/employees/${created.body._id}`);
      expect(ownGetOtherEmployee.status).toBe(404);
    });
  });

  describe("PayPeriodConfig + EmployeeGroup + Site + Task + PayrollCalendar (smoke)", () => {
    it("creates a daily PayPeriodConfig, then an EmployeeGroup FK-referencing it", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({
        role: "CLIENT_ADMIN",
        clientId,
        permissions: ["payPeriodConfig:read", "payPeriodConfig:write", "employeeGroup:read", "employeeGroup:write"],
      });
      const client = authed(ctx.app, token);

      const config = await client.post("/api/v1/pay-period-configs", { clientId, name: "Daily", cadence: "daily", timezone: "UTC" });
      expect(config.status).toBe(201);

      const group = await client.post("/api/v1/employee-groups", { clientId, name: "Warehouse", payPeriodConfigId: config.body._id });
      expect(group.status).toBe(201);

      const rejectedGroup = await client.post("/api/v1/employee-groups", { clientId, name: "Bad", payPeriodConfigId: newClientId() });
      expect(rejectedGroup.status).toBe(400);
    });

    it("creates a Site and a Task, and rejects both without permission", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["site:read", "site:write", "task:read"] });
      const client = authed(ctx.app, token);

      const site = await client.post("/api/v1/sites", { clientId, siteId: "S-1", name: "Main St", timezone: "UTC" });
      expect(site.status).toBe(201);

      const task = await client.post("/api/v1/tasks", { clientId, name: "Cashier" });
      expect(task.status).toBe(403); // missing task:write
    });

    it("creates a PayrollCalendar", async () => {
      const clientId = newClientId();
      const { token } = seedAuthedUser({ role: "CLIENT_ADMIN", clientId, permissions: ["payrollCalendar:read", "payrollCalendar:write"] });
      const client = authed(ctx.app, token);

      const calendar = await client.post("/api/v1/payroll-calendars", {
        clientId,
        name: "2026",
        rows: [{ periodEnd: "2026-01-15", payDate: "2026-01-22" }],
      });
      expect(calendar.status).toBe(201);
      expect(calendar.body.rows).toHaveLength(1);
    });
  });
});
