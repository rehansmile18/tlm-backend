import { z } from "zod";

const locationSchema = z.object({
  addressLine1: z.string().min(1).nullable().optional(),
  addressLine2: z.string().min(1).nullable().optional(),
  city: z.string().min(1).nullable().optional(),
  state: z.string().min(1).nullable().optional(),
  country: z.string().min(1).nullable().optional(),
  postalCode: z.string().min(1).nullable().optional(),
});

const customFieldsSchema = z.record(z.string().min(1), z.string());

export const createEmployeeSchema = z.object({
  clientId: z.string(),
  employeeId: z.string().min(1),
  employeeGroupId: z.string().nullable().optional(),
  timezone: z.string().min(1),
  payPeriodConfigId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  location: locationSchema.nullable().optional(),
  customFields: customFieldsSchema.nullable().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// clientId is deliberately excluded — an employee never moves between clients.
export const updateEmployeeSchema = z.object({
  employeeId: z.string().min(1).optional(),
  employeeGroupId: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
  payPeriodConfigId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  location: locationSchema.nullable().optional(),
  customFields: customFieldsSchema.nullable().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const listEmployeesQuerySchema = z.object({
  clientId: z.string().optional(),
  employeeGroupId: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const employeeIdParamSchema = z.object({
  id: z.string(),
});
