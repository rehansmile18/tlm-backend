import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createPayrollCalendarSchema,
  updatePayrollCalendarSchema,
  listPayrollCalendarsQuerySchema,
  payrollCalendarIdParamSchema,
} from "./payrollCalendar.validators";
import {
  listPayrollCalendarsHandler,
  getPayrollCalendarHandler,
  createPayrollCalendarHandler,
  updatePayrollCalendarHandler,
} from "./payrollCalendar.controller";

export const payrollCalendarRouter = Router();
payrollCalendarRouter.use(authenticate);

payrollCalendarRouter.get(
  "/payroll-calendars",
  requirePermission("payrollCalendar:read"),
  validateRequest({ query: listPayrollCalendarsQuerySchema }),
  listPayrollCalendarsHandler
);
payrollCalendarRouter.get(
  "/payroll-calendars/:id",
  requirePermission("payrollCalendar:read"),
  validateRequest({ params: payrollCalendarIdParamSchema }),
  getPayrollCalendarHandler
);
payrollCalendarRouter.post(
  "/payroll-calendars",
  requirePermission("payrollCalendar:write"),
  validateRequest({ body: createPayrollCalendarSchema }),
  createPayrollCalendarHandler
);
payrollCalendarRouter.patch(
  "/payroll-calendars/:id",
  requirePermission("payrollCalendar:write"),
  validateRequest({ params: payrollCalendarIdParamSchema, body: updatePayrollCalendarSchema }),
  updatePayrollCalendarHandler
);
