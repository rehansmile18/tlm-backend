import "dotenv/config";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

// Same reasoning as TLM's and tlm-punch-processor's env.ts: any environment other than an
// explicitly-declared local dev/test must supply real secrets, so a deploy that forgets NODE_ENV
// (or sets it to something unrecognized) refuses to boot on a placeholder secret.
const allowsInsecureDefaults = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const INSECURE_DEFAULTS = new Set(["dev-secret-change-me", "change-me-in-production", "change-me-immediately"]);

function resolveSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (!value) {
    if (!allowsInsecureDefaults) {
      throw new Error(
        `${name} must be set unless NODE_ENV is "development" or "test" (NODE_ENV=${process.env.NODE_ENV ?? "<unset>"})`
      );
    }
    return devFallback;
  }
  if (!allowsInsecureDefaults && INSECURE_DEFAULTS.has(value)) {
    throw new Error(`${name} is set to a known insecure default; set a real value before running outside local dev/test`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4200),
  // This service's OWN database — Schedule and EmployeeSiteAssignment... wait, EmployeeSiteAssignment
  // actually lives in TLM's DB (see ruleRepoMongoUri below); this DB holds only Schedule (and any
  // future site-ops-only operational state).
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/tlm_backend",
  // TLM's own MongoDB database. Employee, EmployeeGroup, Site, Task, PayPeriodConfig,
  // PayrollCalendar, Punch, and EmployeeSiteAssignment all live THERE — client-owned master data
  // that belongs alongside the Client/User records TLM already owns. This service is now the sole
  // public CRUD owner of that data (tlm-punch-processor's own copies became internal-read-only for
  // its engine), reached via a second Mongoose connection — see config/db.ts's `ruleRepoConnection`.
  ruleRepoMongoUri: process.env.RULE_REPO_MONGODB_URI ?? "mongodb://localhost:27017/tlm_rule_repository",
  // Must be the SAME secret TLM's JWT_SECRET is set to — this service verifies the identical
  // human-login JWTs TLM issues for EVERY role (PLATFORM_ADMIN/CLIENT_ADMIN/VIEWER/SITE_MANAGER),
  // it does not mint its own. TLM remains the single auth authority for all users.
  jwtSecret: resolveSecret("JWT_SECRET", "dev-secret-change-me"),
  nodeEnv,
  isProduction,

  // TLM's own API — used only for GET /users/me (resolving live role/clientId/siteIds/permissions
  // for the caller's own bearer token; never a service-account call).
  ruleRepoBaseUrl: process.env.RULE_REPO_BASE_URL ?? "http://localhost:4000/api/v1",

  // tlm-punch-processor's own API — the internal calculation engine this service calls to trigger
  // processing and to proxy Timesheet reads/void. Not reachable by end users directly.
  punchProcessorBaseUrl: process.env.PUNCH_PROCESSOR_BASE_URL ?? "http://localhost:4100/api/v1",
  // Credentials for a PLATFORM_ADMIN service-account User seeded in TLM — used only for this
  // service's own outbound calls to punch-processor's processing/timesheet endpoints (a trusted
  // service identity, separate from punch-processor's own credentials against TLM). Stored as
  // email/password rather than a pre-minted JWT: clients/punchProcessorClient.ts logs in fresh
  // whenever its cached token is missing or near expiry, so this credential itself never expires
  // the way a static JWT would (TLM's own JWT_EXPIRES_IN, 12h by default).
  punchProcessorServiceAccountEmail: process.env.PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL ?? "svc-tlm-backend@internal",
  punchProcessorServiceAccountPassword: resolveSecret("PUNCH_PROCESSOR_SERVICE_ACCOUNT_PASSWORD", "dev-secret-change-me"),

  // A single shared secret for kiosk/upstream time-clock systems submitting punches — deliberately
  // NOT a TLM user/JWT. Mirrors tlm-punch-processor's own PUNCH_INGEST_API_KEY (which is retired
  // once this service takes over punch ingestion).
  punchIngestApiKey: resolveSecret("PUNCH_INGEST_API_KEY", "dev-secret-change-me"),

  // How long a cached (role, clientId, siteIds, permissions, status) lookup from TLM's
  // GET /users/me is trusted before this service re-checks it.
  userProfileCacheMs: Number(process.env.USER_PROFILE_CACHE_MS ?? 60_000),
};

/**
 * Same fail-closed philosophy as resolveSecret above, applied to CORS: an unrestricted origin
 * policy is a fine local/dev default (requests still require a bearer token), but must be an
 * explicit choice — not a silent default — anywhere else.
 */
export function resolveCorsOrigins(): string[] | undefined {
  const configured = process.env.CORS_ORIGIN?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return configured;
  if (!allowsInsecureDefaults) {
    throw new Error(
      `CORS_ORIGIN must be set unless NODE_ENV is "development" or "test" (NODE_ENV=${process.env.NODE_ENV ?? "<unset>"}) — an unrestricted CORS policy is not allowed outside local dev/test`
    );
  }
  return undefined;
}
