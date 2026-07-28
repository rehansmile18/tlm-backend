import { z } from "zod";

export const createEmployeeSiteAssignmentSchema = z.object({
  siteId: z.string().min(1),
  isPrimary: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type CreateEmployeeSiteAssignmentInput = z.infer<typeof createEmployeeSiteAssignmentSchema>;

export const employeeIdParamSchema = z.object({
  id: z.string(),
});

export const employeeSiteParamSchema = z.object({
  id: z.string(),
  siteId: z.string(),
});
