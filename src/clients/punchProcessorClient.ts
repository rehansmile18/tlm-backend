import { env } from "../config/env";
import { HttpError } from "../utils/errors";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

// Refresh this many ms before the cached token's real expiry, so an in-flight request never races
// a token that's valid when read but expired by the time the outbound call actually lands.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;
// If the token's exp claim can't be read for any reason, treat it as short-lived rather than
// caching something indefinitely on a parsing failure.
const FALLBACK_TOKEN_TTL_MS = 5 * 60_000;

let cachedServiceToken: { token: string; expiresAt: number } | null = null;

function decodeJwtExpiryMs(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + FALLBACK_TOKEN_TTL_MS;
  } catch {
    return Date.now() + FALLBACK_TOKEN_TTL_MS;
  }
}

async function loginServiceAccount(): Promise<string> {
  const res = await fetch(`${env.ruleRepoBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.punchProcessorServiceAccountEmail, password: env.punchProcessorServiceAccountPassword }),
  });
  if (!res.ok) {
    throw new HttpError(
      502,
      `Could not authenticate this service's own punch-processor service account against the Rule Repository: ${res.status} ${await res.text()}`
    );
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

/**
 * Logs this service's own service-account identity into TLM on demand rather than relying on a
 * pre-minted, statically-configured JWT — that design expired every ~12h (TLM's own
 * JWT_EXPIRES_IN) and needed manual re-minting. Cached in memory, refreshed proactively before
 * expiry and reactively on a 401 from punch-processor (see callPunchProcessor's retry below).
 */
async function getServiceToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedServiceToken && cachedServiceToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return cachedServiceToken.token;
  }
  const token = await loginServiceAccount();
  cachedServiceToken = { token, expiresAt: decodeJwtExpiryMs(token) };
  return token;
}

export interface TriggerProcessingParams {
  clientId: string;
  employeeIds: string[];
  asOfDate: string; // "YYYY-MM-DD"
}

export interface ListTimesheetsParams {
  clientId?: string;
  employeeId?: string;
  payPeriodId?: string;
  status?: string;
  includeSuperseded?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Thin HTTP client for this service's internal engine dependency: tlm-punch-processor.
 * Authenticates every call with a dedicated PLATFORM_ADMIN service-account identity (see
 * getServiceToken above) — this service performs its own permission/scope authorization on the
 * original caller FIRST (see routes), then calls punch-processor as a trusted service identity,
 * exactly mirroring how punch-processor itself calls TLM via ruleRepositoryClient.ts.
 */
async function callPunchProcessor<T>(
  path: string,
  init?: { method?: string; query?: Record<string, string | undefined>; body?: unknown }
): Promise<T> {
  const url = new URL(`${env.punchProcessorBaseUrl}${path}`);
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  let lastError: unknown;
  let forceTokenRefresh = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const token = await getServiceToken(forceTokenRefresh);
      forceTokenRefresh = false;
      const res = await fetch(url.toString(), {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        // Our own service-account token was rejected mid-cache-window (clock skew, an
        // out-of-band revocation) — force a fresh login and retry, rather than surfacing this as
        // a caller-facing error; it has nothing to do with the ORIGINAL caller's own token.
        if (res.status === 401 && attempt < MAX_RETRIES) {
          forceTokenRefresh = true;
          lastError = new Error("Punch processor rejected our service-account token; retrying with a fresh one");
          continue;
        }
        // 4xx is otherwise a caller/config mistake — retrying won't help, surface immediately.
        if (res.status < 500) {
          const body = await res.text();
          throw new HttpError(res.status, `Punch processor rejected ${path}: ${res.status} ${body.slice(0, 300)}`);
        }
        throw new Error(`Punch processor ${path} returned ${res.status}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (err instanceof HttpError) throw err; // don't retry a definitive 4xx
      // otherwise fall through and retry (network error, timeout, 5xx, or a forced token refresh)
    }
  }
  throw new HttpError(
    502,
    `Punch processor unreachable after ${MAX_RETRIES + 1} attempts calling ${path}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export const punchProcessorClient = {
  triggerProcessing: (params: TriggerProcessingParams): Promise<unknown> =>
    callPunchProcessor("/processing/runs", { method: "POST", body: params }),

  listTimesheets: (params: ListTimesheetsParams): Promise<unknown> =>
    callPunchProcessor("/timesheets", {
      query: {
        clientId: params.clientId,
        employeeId: params.employeeId,
        payPeriodId: params.payPeriodId,
        status: params.status,
        includeSuperseded: params.includeSuperseded !== undefined ? String(params.includeSuperseded) : undefined,
        page: params.page !== undefined ? String(params.page) : undefined,
        pageSize: params.pageSize !== undefined ? String(params.pageSize) : undefined,
      },
    }),

  getTimesheet: (id: string): Promise<unknown> => callPunchProcessor(`/timesheets/${id}`),

  getTimesheetAuditTrail: (id: string): Promise<unknown> => callPunchProcessor(`/timesheets/${id}/audit-trail`),

  voidTimesheet: (id: string, reason: string): Promise<unknown> =>
    callPunchProcessor(`/timesheets/${id}/void`, { method: "POST", body: { reason } }),

  /** Short-timeout, non-blocking reachability probe used by this service's own GET /health. */
  healthCheck: async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      const res = await fetch(`${env.punchProcessorBaseUrl.replace(/\/api\/v1$/, "")}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  },
};
