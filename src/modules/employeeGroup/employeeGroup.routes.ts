import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createEmployeeGroupSchema,
  updateEmployeeGroupSchema,
  listEmployeeGroupsQuerySchema,
  employeeGroupIdParamSchema,
} from "./employeeGroup.validators";
import {
  listEmployeeGroupsHandler,
  getEmployeeGroupHandler,
  createEmployeeGroupHandler,
  updateEmployeeGroupHandler,
} from "./employeeGroup.controller";

export const employeeGroupRouter = Router();
employeeGroupRouter.use(authenticate);

employeeGroupRouter.get(
  "/employee-groups",
  requirePermission("employeeGroup:read"),
  validateRequest({ query: listEmployeeGroupsQuerySchema }),
  listEmployeeGroupsHandler
);
employeeGroupRouter.get(
  "/employee-groups/:id",
  requirePermission("employeeGroup:read"),
  validateRequest({ params: employeeGroupIdParamSchema }),
  getEmployeeGroupHandler
);
employeeGroupRouter.post(
  "/employee-groups",
  requirePermission("employeeGroup:write"),
  validateRequest({ body: createEmployeeGroupSchema }),
  createEmployeeGroupHandler
);
employeeGroupRouter.patch(
  "/employee-groups/:id",
  requirePermission("employeeGroup:write"),
  validateRequest({ params: employeeGroupIdParamSchema, body: updateEmployeeGroupSchema }),
  updateEmployeeGroupHandler
);
