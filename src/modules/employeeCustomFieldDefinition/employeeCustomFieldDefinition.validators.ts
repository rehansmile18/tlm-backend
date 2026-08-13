import { z } from "zod";

export const createEmployeeCustomFieldDefinitionSchema = z.object({
  clientId: z.string(),
  name: z.string().min(1).max(60),
});
export type CreateEmployeeCustomFieldDefinitionInput = z.infer<typeof createEmployeeCustomFieldDefinitionSchema>;

export const listEmployeeCustomFieldDefinitionsQuerySchema = z.object({
  clientId: z.string().optional(),
});
