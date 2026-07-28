import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema, employeeIdParamSchema } from "./employee.validators";
import { listEmployeesHandler, getEmployeeHandler, createEmployeeHandler, updateEmployeeHandler } from "./employee.controller";

export const employeeRouter = Router();
employeeRouter.use(authenticate);

employeeRouter.get(
  "/employees",
  requirePermission("employee:read"),
  validateRequest({ query: listEmployeesQuerySchema }),
  listEmployeesHandler
);
employeeRouter.get(
  "/employees/:id",
  requirePermission("employee:read"),
  validateRequest({ params: employeeIdParamSchema }),
  getEmployeeHandler
);
employeeRouter.post(
  "/employees",
  requirePermission("employee:write"),
  validateRequest({ body: createEmployeeSchema }),
  createEmployeeHandler
);
employeeRouter.patch(
  "/employees/:id",
  requirePermission("employee:write"),
  validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  updateEmployeeHandler
);
