import { env } from "../config/env";
import { getPermissionsCatalog } from "../modules/permissionsCatalog/permissionsCatalog.service";
import { UserRole } from "../types/domain";

// Mirrors tlm-punch-processor's own seed.ts in spirit (idempotent, minimal, clear console output)
// but this service needs TWO kinds of seeding: (1) the one credential it uses OUTBOUND, a
// PLATFORM_ADMIN service-account User in TLM — this script just ensures the account EXISTS;
// clients/punchProcessorClient.ts logs into it fresh on demand at runtime (via
// PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL/PASSWORD), so there's no JWT to mint or re-mint here; and
// (2), optionally, demo human users (CLIENT_ADMIN/SITE_MANAGER/VIEWER) seeded with the catalog's
// recommended-default permissions, since TLM itself no longer computes any defaults.

const SEED_EMAIL = process.env.SEED_SERVICE_ACCOUNT_EMAIL ?? "svc-tlm-backend@internal";
const SEED_PASSWORD = process.env.SEED_SERVICE_ACCOUNT_PASSWORD;

const base = env.ruleRepoBaseUrl;

async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function createUser(
  adminToken: string,
  input: { email: string; password: string; role: UserRole; clientId?: string; siteIds?: string[]; permissions?: string[] }
): Promise<void> {
  const res = await fetch(`${base}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Could not create user ${input.email} in TLM: ${res.status} ${await res.text()}`);
  }
}

async function seedServiceAccount(bootstrapToken: () => Promise<string>): Promise<void> {
  if (!SEED_PASSWORD) {
    console.error("Set SEED_SERVICE_ACCOUNT_PASSWORD before running this script (a real password for the new TLM service-account user).");
    process.exit(1);
  }

  const existingToken = await login(SEED_EMAIL, SEED_PASSWORD);
  if (existingToken) {
    console.log(`Service-account user ${SEED_EMAIL} already exists in TLM — nothing to create.`);
    printServiceAccountEnv();
    return;
  }

  const adminToken = await bootstrapToken();
  await createUser(adminToken, { email: SEED_EMAIL, password: SEED_PASSWORD, role: "PLATFORM_ADMIN" });
  console.log(`Created service-account user ${SEED_EMAIL} in TLM (role PLATFORM_ADMIN).`);
  printServiceAccountEnv();
}

function printServiceAccountEnv(): void {
  console.log("\nSet these in this service's .env (this service logs in fresh on demand, so nothing here ever expires):\n");
  console.log(`PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL=${SEED_EMAIL}`);
  console.log(`PUNCH_PROCESSOR_SERVICE_ACCOUNT_PASSWORD=${SEED_PASSWORD}`);
}

/**
 * Optional: only runs if SEED_DEMO_CLIENT_ID (an existing Client's Mongo _id in TLM) is set —
 * there's no Client to attach demo users to otherwise, and this script has no business creating
 * one (Client is TLM's own top-level resource, out of scope here).
 */
async function seedDemoUsers(bootstrapToken: () => Promise<string>): Promise<void> {
  const demoClientId = process.env.SEED_DEMO_CLIENT_ID;
  if (!demoClientId) {
    console.log("\nSEED_DEMO_CLIENT_ID not set — skipping demo CLIENT_ADMIN/SITE_MANAGER/VIEWER user creation.");
    return;
  }
  const demoSiteId = process.env.SEED_DEMO_SITE_ID;
  if (!demoSiteId) {
    console.error("SEED_DEMO_CLIENT_ID is set but SEED_DEMO_SITE_ID is not — a demo SITE_MANAGER needs at least one site to be scoped to.");
    process.exit(1);
  }

  const adminToken = await bootstrapToken();
  const { recommendedDefaults } = getPermissionsCatalog();
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Demo-Pass1!";

  const demoUsers: { email: string; role: UserRole; siteIds?: string[] }[] = [
    { email: "demo-client-admin@internal", role: "CLIENT_ADMIN" },
    { email: "demo-site-manager@internal", role: "SITE_MANAGER", siteIds: [demoSiteId] },
    { email: "demo-viewer@internal", role: "VIEWER" },
  ];

  for (const demoUser of demoUsers) {
    const alreadyExists = await login(demoUser.email, demoPassword);
    if (alreadyExists) {
      console.log(`Demo user ${demoUser.email} already exists — skipping.`);
      continue;
    }
    await createUser(adminToken, {
      email: demoUser.email,
      password: demoPassword,
      role: demoUser.role,
      clientId: demoClientId,
      siteIds: demoUser.siteIds,
      permissions: recommendedDefaults[demoUser.role],
    });
    console.log(`Created demo ${demoUser.role} user ${demoUser.email} (password: ${demoPassword}).`);
  }
}

async function main(): Promise<void> {
  const bootstrapEmail = process.env.TLM_BOOTSTRAP_ADMIN_EMAIL;
  const bootstrapPassword = process.env.TLM_BOOTSTRAP_ADMIN_PASSWORD;
  let cachedBootstrapToken: string | null = null;
  const bootstrapToken = async (): Promise<string> => {
    if (cachedBootstrapToken) return cachedBootstrapToken;
    if (!bootstrapEmail || !bootstrapPassword) {
      console.error(
        "Need an existing PLATFORM_ADMIN's credentials in TLM to create new users (e.g. the admin TLM's own `npm run seed` produced).\n" +
          "Set TLM_BOOTSTRAP_ADMIN_EMAIL/TLM_BOOTSTRAP_ADMIN_PASSWORD, or create users manually via TLM's POST /users."
      );
      process.exit(1);
    }
    const token = await login(bootstrapEmail, bootstrapPassword);
    if (!token) throw new Error(`Could not log into TLM as ${bootstrapEmail}`);
    cachedBootstrapToken = token;
    return token;
  };

  await seedServiceAccount(bootstrapToken);
  await seedDemoUsers(bootstrapToken);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
