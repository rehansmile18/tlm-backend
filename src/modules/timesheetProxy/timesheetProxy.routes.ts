import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import { listTimesheetsQuerySchema, timesheetIdParamSchema, voidTimesheetSchema } from "./timesheetProxy.validators";
import {
  listTimesheetsHandler,
  getTimesheetHandler,
  getTimesheetAuditTrailHandler,
  voidTimesheetHandler,
} from "./timesheetProxy.controller";

export const timesheetProxyRouter = Router();
timesheetProxyRouter.use(authenticate);

timesheetProxyRouter.get(
  "/timesheets",
  requirePermission("timesheet:read"),
  validateRequest({ query: listTimesheetsQuerySchema }),
  listTimesheetsHandler
);
timesheetProxyRouter.get(
  "/timesheets/:id",
  requirePermission("timesheet:read"),
  validateRequest({ params: timesheetIdParamSchema }),
  getTimesheetHandler
);
timesheetProxyRouter.get(
  "/timesheets/:id/audit-trail",
  requirePermission("timesheet:read"),
  validateRequest({ params: timesheetIdParamSchema }),
  getTimesheetAuditTrailHandler
);
timesheetProxyRouter.post(
  "/timesheets/:id/void",
  requirePermission("timesheet:void"),
  validateRequest({ params: timesheetIdParamSchema, body: voidTimesheetSchema }),
  voidTimesheetHandler
);
