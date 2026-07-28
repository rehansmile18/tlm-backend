import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertSameSite } from "../../middleware/tenantScope";
import * as employeeSiteAssignmentService from "./employeeSiteAssignment.service";
import { CreateEmployeeSiteAssignmentInput } from "./employeeSiteAssignment.validators";

export const listEmployeeSitesHandler = asyncHandler(async (req: Request, res: Response) => {
  const items = await employeeSiteAssignmentService.listSitesForEmployee(req.params.id, getReadClientFilter(req));
  res.json({ items });
});

export const assignEmployeeSiteHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateEmployeeSiteAssignmentInput;
  // Load the employee under the caller's own read filter first, then authorize the TARGET site
  // against the caller's own managed sites (SITE_MANAGER can only wire up sites they run).
  const employee = await employeeSiteAssignmentService.getEmployeeInScope(req.params.id, getReadClientFilter(req));
  assertSameSite(req, String(employee.clientId), input.siteId);
  const doc = await employeeSiteAssignmentService.assignEmployeeToSite(employee, input);
  res.status(201).json(doc);
});

export const unassignEmployeeSiteHandler = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeSiteAssignmentService.getEmployeeInScope(req.params.id, getReadClientFilter(req));
  assertSameSite(req, String(employee.clientId), req.params.siteId);
  await employeeSiteAssignmentService.unassignEmployeeFromSite(employee, req.params.siteId);
  res.status(204).send();
});
