import { z } from "zod";
import { Types } from "mongoose";

export const listTimesheetsQuerySchema = z.object({
  clientId: z.string().optional(),
  employeeId: z.string().optional(),
  payPeriodId: z.string().optional(),
  status: z.enum(["draft", "completed", "superseded", "voided", "failed"]).optional(),
  includeSuperseded: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListTimesheetsQuery = z.infer<typeof listTimesheetsQuerySchema>;

// Unlike other modules' id params (which flow into a Mongoose query and get a clean CastError on
// a malformed value for free), this id is interpolated directly into an outbound URL path to
// punch-processor (see timesheetProxy.controller.ts's getTimesheet et al.) — so it's validated as
// a real Mongo ObjectId here, up front, rather than trusting whatever string arrives in the path.
export const timesheetIdParamSchema = z.object({
  id: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid timesheet id"),
});

export const voidTimesheetSchema = z.object({ reason: z.string().min(1) });
export type VoidTimesheetInput = z.infer<typeof voidTimesheetSchema>;

export const listTimesheetSiteGroupsQuerySchema = z.object({
  clientId: z.string().optional(),
  siteId: z.string().optional(),
  payPeriodId: z.string().optional(),
  includeSuperseded: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListTimesheetSiteGroupsQuery = z.infer<typeof listTimesheetSiteGroupsQuerySchema>;

export const timesheetGridParamSchema = z.object({
  siteId: z.string().min(1),
  payPeriodId: z.string().min(1),
});

export const timesheetGridQuerySchema = z.object({
  includeSuperseded: z.coerce.boolean().optional(),
});
