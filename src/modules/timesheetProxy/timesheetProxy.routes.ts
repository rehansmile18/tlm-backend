import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  listTimesheetsQuerySchema,
  timesheetIdParamSchema,
  voidTimesheetSchema,
  listTimesheetSiteGroupsQuerySchema,
  timesheetGridParamSchema,
  timesheetGridQuerySchema,
} from "./timesheetProxy.validators";
import {
  listTimesheetsHandler,
  getTimesheetHandler,
  getTimesheetAuditTrailHandler,
  voidTimesheetHandler,
  listTimesheetSiteGroupsHandler,
  getTimesheetGridHandler,
} from "./timesheetProxy.controller";

export const timesheetProxyRouter = Router();
timesheetProxyRouter.use(authenticate);

// Registered before /timesheets/:id — otherwise Express's param route would greedily match
// "by-site" as an :id.
timesheetProxyRouter.get(
  "/timesheets/by-site",
  requirePermission("timesheet:read"),
  validateRequest({ query: listTimesheetSiteGroupsQuerySchema }),
  listTimesheetSiteGroupsHandler
);
timesheetProxyRouter.get(
  "/timesheets/by-site/:siteId/:payPeriodId",
  requirePermission("timesheet:read"),
  validateRequest({ params: timesheetGridParamSchema, query: timesheetGridQuerySchema }),
  getTimesheetGridHandler
);

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
