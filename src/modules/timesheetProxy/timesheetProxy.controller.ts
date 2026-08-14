import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertSameClient, assertSameSite } from "../../middleware/tenantScope";
import { punchProcessorClient } from "../../clients/punchProcessorClient";
import { VoidTimesheetInput } from "./timesheetProxy.validators";

/**
 * This service has no direct DB access to Timesheet documents — they live in punch-processor's
 * own database. Every outbound call authenticates as the trusted PLATFORM_ADMIN service account
 * (see punchProcessorClient), so punch-processor applies no tenant filter on our behalf; the real
 * tenant boundary is enforced HERE — either by forwarding the caller's own resolved clientId as a
 * query param (list), or by fetching then checking the returned document's clientId (get/audit/void).
 */
function resolveClientIdForProxy(req: Request): string | undefined {
  const filter = getReadClientFilter(req);
  return filter.clientId ? String(filter.clientId) : undefined;
}

/**
 * The site-grouped endpoints are inherently site-scoped, so a SITE_MANAGER's visibility is
 * narrowed by forwarding their own managed siteIds as an allow-list to punch-processor's
 * aggregation — mirrors getReadSiteFilter's `{siteId: {$in: siteIds}}` shape, just translated
 * into query params since this is a cross-service HTTP call rather than a Mongo query.
 */
function resolveSiteIdsForProxy(req: Request): string[] | undefined {
  return req.auth?.role === "SITE_MANAGER" ? req.auth.siteIds : undefined;
}

interface TimesheetSummary {
  clientId: string;
  [key: string]: unknown;
}

export const listTimesheetsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, payPeriodId, status, includeSuperseded, page, pageSize } = req.query as unknown as {
    employeeId?: string;
    payPeriodId?: string;
    status?: string;
    includeSuperseded?: boolean;
    page: number;
    pageSize: number;
  };
  const result = await punchProcessorClient.listTimesheets({
    clientId: resolveClientIdForProxy(req),
    employeeId,
    payPeriodId,
    status,
    includeSuperseded,
    page,
    pageSize,
  });
  res.json(result);
});

export const getTimesheetHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = (await punchProcessorClient.getTimesheet(req.params.id)) as TimesheetSummary;
  assertSameClient(req, doc.clientId);
  res.json(doc);
});

export const getTimesheetAuditTrailHandler = asyncHandler(async (req: Request, res: Response) => {
  // Fetched purely to authorize — its clientId gates whether the caller may see the audit trail.
  const timesheet = (await punchProcessorClient.getTimesheet(req.params.id)) as TimesheetSummary;
  assertSameClient(req, timesheet.clientId);
  const result = await punchProcessorClient.getTimesheetAuditTrail(req.params.id);
  res.json(result);
});

export const voidTimesheetHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = (await punchProcessorClient.getTimesheet(req.params.id)) as TimesheetSummary;
  assertSameClient(req, existing.clientId);
  const { reason } = req.body as VoidTimesheetInput;
  const doc = await punchProcessorClient.voidTimesheet(req.params.id, reason);
  res.json(doc);
});

export const listTimesheetSiteGroupsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { siteId, payPeriodId, includeSuperseded, page, pageSize } = req.query as unknown as {
    siteId?: string;
    payPeriodId?: string;
    includeSuperseded?: boolean;
    page: number;
    pageSize: number;
  };
  const clientId = resolveClientIdForProxy(req);
  if (siteId) assertSameSite(req, clientId ?? "", siteId);

  const result = await punchProcessorClient.listTimesheetSiteGroups({
    clientId,
    siteId,
    siteIds: resolveSiteIdsForProxy(req),
    payPeriodId,
    includeSuperseded,
    page,
    pageSize,
  });
  res.json(result);
});

export const getTimesheetGridHandler = asyncHandler(async (req: Request, res: Response) => {
  const { siteId, payPeriodId } = req.params as { siteId: string; payPeriodId: string };
  const { includeSuperseded } = req.query as unknown as { includeSuperseded?: boolean };
  const clientId = resolveClientIdForProxy(req);
  assertSameSite(req, clientId ?? "", siteId);

  const result = await punchProcessorClient.getTimesheetGrid(siteId, payPeriodId, { clientId, includeSuperseded });
  res.json(result);
});
