import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createEmployeeCustomFieldDefinitionSchema,
  listEmployeeCustomFieldDefinitionsQuerySchema,
} from "./employeeCustomFieldDefinition.validators";
import {
  listEmployeeCustomFieldDefinitionsHandler,
  createEmployeeCustomFieldDefinitionHandler,
} from "./employeeCustomFieldDefinition.controller";

export const employeeCustomFieldDefinitionRouter = Router();
employeeCustomFieldDefinitionRouter.use(authenticate);

employeeCustomFieldDefinitionRouter.get(
  "/employee-custom-fields",
  requirePermission("employee:read"),
  validateRequest({ query: listEmployeeCustomFieldDefinitionsQuerySchema }),
  listEmployeeCustomFieldDefinitionsHandler
);
employeeCustomFieldDefinitionRouter.post(
  "/employee-custom-fields",
  requirePermission("employee:write"),
  validateRequest({ body: createEmployeeCustomFieldDefinitionSchema }),
  createEmployeeCustomFieldDefinitionHandler
);
