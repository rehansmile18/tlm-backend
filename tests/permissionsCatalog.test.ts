import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestContext, seedAuthedUser, authed, newClientId, TestContext } from "./helpers";

describe("GET /permissions/catalog", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTestContext();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it("returns the full key catalog and recommended defaults to any logged-in user, regardless of their own permissions", async () => {
    const { token } = seedAuthedUser({ role: "VIEWER", clientId: newClientId(), permissions: [] });
    const client = authed(ctx.app, token);

    const res = await client.get("/api/v1/permissions/catalog");
    expect(res.status).toBe(200);
    expect(res.body.keys).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "schedule:write", description: expect.any(String) })])
    );
    expect(res.body.recommendedDefaults.SITE_MANAGER).toEqual(expect.arrayContaining(["schedule:write", "punch:write"]));
    expect(res.body.recommendedDefaults.PLATFORM_ADMIN).toEqual([]);
  });

  it("rejects without a valid token", async () => {
    const res = await authed(ctx.app, "not-a-real-token").get("/api/v1/permissions/catalog");
    expect(res.status).toBe(401);
  });
});
