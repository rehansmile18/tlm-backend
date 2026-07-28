import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertSameClient } from "../../middleware/tenantScope";
import * as punchService from "./punch.service";
import { CreatePunchInput, BulkCreatePunchInput, CorrectPunchInput } from "./punch.validators";

/**
 * A PUNCH_INGEST credential (kiosk/upstream time-clock system, see punchIngestAuth.ts) has no
 * clientId of its own and no permissions array — it isn't a permission-bearing human user, so the
 * normal tenant-scope check would always reject it. The bypass lives HERE, local to punch writes
 * only (see punch.routes.ts's allowIngestOrRequirePermission for the analogous permission-gate
 * bypass), rather than loosening the shared tenantScope/permissions utilities for every module.
 */
function assertCanWritePunch(req: Request, targetClientId: string): void {
  if (req.auth?.role === "PUNCH_INGEST") return;
  assertSameClient(req, targetClientId);
}

export const createPunchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreatePunchInput;
  assertCanWritePunch(req, input.clientId);
  const doc = await punchService.createPunch(input);
  res.status(201).json(doc);
});

export const bulkCreatePunchesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { punches } = req.body as BulkCreatePunchInput;
  for (const punch of punches) {
    assertCanWritePunch(req, punch.clientId);
  }
  const result = await punchService.bulkCreatePunches(punches);
  res.status(207).json(result);
});

export const listPunchesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, siteId, from, to, page, pageSize } = req.query as unknown as {
    employeeId?: string;
    siteId?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  };
  const result = await punchService.listPunches(getReadClientFilter(req), { employeeId, siteId, from, to }, page, pageSize);
  res.json(result);
});

export const getPunchHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await punchService.getPunch(req.params.id, getReadClientFilter(req));
  res.json(doc);
});

export const correctPunchHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await punchService.getPunch(req.params.id, getReadClientFilter(req));
  assertSameClient(req, String(existing.clientId));
  const doc = await punchService.correctPunch(req.params.id, req.body as CorrectPunchInput, getReadClientFilter(req));
  res.status(201).json(doc);
});
