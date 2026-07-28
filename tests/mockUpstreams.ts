// Installs a single global fetch() mock for the whole test run, dispatched by URL path, so this
// service's test suite never needs a real TLM or tlm-punch-processor instance running. Mirrors
// tlm-punch-processor's own tests/mockRuleRepo.ts, extended to also stand in for punch-processor's
// own API (this service proxies timesheet/processing calls to it).

export interface MockProfile {
  role: "PLATFORM_ADMIN" | "CLIENT_ADMIN" | "VIEWER" | "SITE_MANAGER" | "PUNCH_INGEST";
  clientId: string | null;
  siteIds?: string[];
  permissions?: string[];
  status?: "active" | "disabled";
}

const profilesByToken = new Map<string, MockProfile>();

type TimesheetHandler = () => unknown;
let timesheetsHandler: TimesheetHandler | null = null;
let timesheetByIdHandler: ((id: string) => unknown) | null = null;
let processingRunHandler: ((body: unknown) => unknown) | null = null;
let voidTimesheetHandler: ((id: string, reason: string) => unknown) | null = null;

export function registerMockProfile(token: string, profile: MockProfile): void {
  profilesByToken.set(token, profile);
}

export function setMockTimesheetsHandler(handler: TimesheetHandler | null): void {
  timesheetsHandler = handler;
}

export function setMockTimesheetByIdHandler(handler: ((id: string) => unknown) | null): void {
  timesheetByIdHandler = handler;
}

export function setMockProcessingRunHandler(handler: ((body: unknown) => unknown) | null): void {
  processingRunHandler = handler;
}

export function setMockVoidTimesheetHandler(handler: ((id: string, reason: string) => unknown) | null): void {
  voidTimesheetHandler = handler;
}

export function resetMockUpstreams(): void {
  profilesByToken.clear();
  timesheetsHandler = null;
  timesheetByIdHandler = null;
  processingRunHandler = null;
  voidTimesheetHandler = null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function extractBearerToken(init: RequestInit | undefined): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  const record = headers as Record<string, string>;
  const raw = record.Authorization ?? record.authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length);
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export function installMockUpstreamsFetch(): void {
  globalThis.fetch = (async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = init?.method ?? "GET";

    if (url.pathname.endsWith("/users/me")) {
      const token = extractBearerToken(init);
      const profile = token ? profilesByToken.get(token) : undefined;
      if (!profile) return jsonResponse({ error: "Unauthorized" }, 401);
      return jsonResponse({
        role: profile.role,
        clientId: profile.clientId,
        siteIds: profile.siteIds ?? [],
        permissions: profile.permissions ?? [],
        status: profile.status ?? "active",
      });
    }

    if (url.pathname.endsWith("/health")) {
      return jsonResponse({ status: "ok" });
    }

    const timesheetVoidMatch = url.pathname.match(/\/timesheets\/([^/]+)\/void$/);
    if (timesheetVoidMatch && method === "POST") {
      const body = init?.body ? (JSON.parse(init.body as string) as { reason: string }) : { reason: "" };
      if (!voidTimesheetHandler) return jsonResponse({ error: "NotFoundError" }, 404);
      return jsonResponse(voidTimesheetHandler(timesheetVoidMatch[1], body.reason));
    }

    if (url.pathname.endsWith("/audit-trail")) {
      return jsonResponse({ entries: [] });
    }

    const timesheetByIdMatch = url.pathname.match(/\/timesheets\/([^/]+)$/);
    if (timesheetByIdMatch) {
      if (!timesheetByIdHandler) return jsonResponse({ error: "NotFoundError" }, 404);
      const doc = timesheetByIdHandler(timesheetByIdMatch[1]);
      if (!doc) return jsonResponse({ error: "NotFoundError" }, 404);
      return jsonResponse(doc);
    }

    if (url.pathname.endsWith("/timesheets")) {
      if (!timesheetsHandler) return jsonResponse({ items: [], total: 0, page: 1, pageSize: 50 });
      return jsonResponse(timesheetsHandler());
    }

    if (url.pathname.endsWith("/processing/runs") && method === "POST") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      if (!processingRunHandler) return jsonResponse({ summary: { completed: 0, skippedLocked: 0, failed: 0 }, items: [] }, 207);
      return jsonResponse(processingRunHandler(body), 207);
    }

    return jsonResponse({ error: "NotFoundError", message: `No mock handler for ${url.pathname}` }, 404);
  }) as typeof fetch;
}
