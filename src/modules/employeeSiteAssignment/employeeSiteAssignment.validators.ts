import { z } from "zod";

export const createEmployeeSiteAssignmentSchema = z.object({
  siteId: z.string().min(1),
  task: z.string().min(1),
  isPrimary: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type CreateEmployeeSiteAssignmentInput = z.infer<typeof createEmployeeSiteAssignmentSchema>;

export const updateEmployeeSiteAssignmentSchema = z.object({
  task: z.string().min(1).optional(),
  isPrimary: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type UpdateEmployeeSiteAssignmentInput = z.infer<typeof updateEmployeeSiteAssignmentSchema>;

export const employeeIdParamSchema = z.object({
  id: z.string(),
});

export const employeeSiteParamSchema = z.object({
  id: z.string(),
  siteId: z.string(),
});
