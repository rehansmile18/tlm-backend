import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createEmployeeSiteAssignmentSchema,
  employeeIdParamSchema,
  employeeSiteParamSchema,
} from "./employeeSiteAssignment.validators";
import {
  listEmployeeSitesHandler,
  assignEmployeeSiteHandler,
  unassignEmployeeSiteHandler,
} from "./employeeSiteAssignment.controller";

export const employeeSiteAssignmentRouter = Router();
employeeSiteAssignmentRouter.use(authenticate);

employeeSiteAssignmentRouter.get(
  "/employees/:id/sites",
  requirePermission("employeeSiteAssignment:read"),
  validateRequest({ params: employeeIdParamSchema }),
  listEmployeeSitesHandler
);
employeeSiteAssignmentRouter.post(
  "/employees/:id/sites",
  requirePermission("employeeSiteAssignment:write"),
  validateRequest({ params: employeeIdParamSchema, body: createEmployeeSiteAssignmentSchema }),
  assignEmployeeSiteHandler
);
employeeSiteAssignmentRouter.delete(
  "/employees/:id/sites/:siteId",
  requirePermission("employeeSiteAssignment:write"),
  validateRequest({ params: employeeSiteParamSchema }),
  unassignEmployeeSiteHandler
);
