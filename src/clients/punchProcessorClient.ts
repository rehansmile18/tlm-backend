import { env } from "../config/env";
import { HttpError } from "../utils/errors";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

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
 * Authenticates every call with a dedicated PLATFORM_ADMIN service-account JWT
 * (PUNCH_PROCESSOR_SERVICE_JWT) — this service performs its own permission/scope authorization on
 * the original caller FIRST (see routes), then calls punch-processor as a trusted service
 * identity, exactly mirroring how punch-processor itself calls TLM via ruleRepositoryClient.ts.
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
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${env.punchProcessorServiceJwt}`,
          ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        // 4xx is a caller/config mistake — retrying won't help, surface immediately.
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
      // otherwise fall through and retry (network error, timeout, 5xx)
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
