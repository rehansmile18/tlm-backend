import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadSiteFilter, assertSameSite } from "../../middleware/tenantScope";
import * as scheduleService from "./schedule.service";
import { CreateScheduleInput, BulkCreateScheduleInput, UpdateScheduleInput } from "./schedule.validators";

export const createScheduleHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateScheduleInput;
  assertSameSite(req, input.clientId, input.siteId);
  const doc = await scheduleService.createSchedule(input, req.auth!.userId);
  res.status(201).json(doc);
});

export const bulkCreateSchedulesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { shifts } = req.body as BulkCreateScheduleInput;
  for (const shift of shifts) {
    assertSameSite(req, shift.clientId, shift.siteId);
  }
  const result = await scheduleService.bulkCreateSchedules(shifts, req.auth!.userId);
  res.status(207).json(result);
});

export const listSchedulesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, siteId, status, from, to, page, pageSize } = req.query as unknown as {
    employeeId?: string;
    siteId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  };
  const result = await scheduleService.listSchedules(getReadSiteFilter(req), { employeeId, siteId, status, from, to }, page, pageSize);
  res.json(result);
});

export const getScheduleHandler = asyncHandler(async (req: Request, res: Response) => {
  // getReadSiteFilter already narrows to the caller's own managed sites for SITE_MANAGER, so a
  // shift outside their scope 404s here rather than needing a separate assertSameSite check.
  const doc = await scheduleService.getSchedule(req.params.id, getReadSiteFilter(req));
  res.json(doc);
});

export const updateScheduleHandler = asyncHandler(async (req: Request, res: Response) => {
  // siteId/employeeId/clientId are never patchable (see schedule.validators.ts), so the
  // getReadSiteFilter-scoped fetch inside updateSchedule is the only authorization this needs.
  const doc = await scheduleService.updateSchedule(req.params.id, req.body as UpdateScheduleInput, getReadSiteFilter(req));
  res.json(doc);
});

export const cancelScheduleHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await scheduleService.cancelSchedule(req.params.id, getReadSiteFilter(req));
  res.json(doc);
});

export const getAdherenceHandler = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, siteId, from, to } = req.query as unknown as {
    employeeId?: string;
    siteId?: string;
    from: Date;
    to: Date;
  };
  const items = await scheduleService.getAdherenceReport(getReadSiteFilter(req), { employeeId, siteId, from, to });
  res.json({ items });
});
