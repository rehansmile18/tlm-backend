import { z } from "zod";

export const createSiteCustomFieldDefinitionSchema = z.object({
  clientId: z.string(),
  name: z.string().min(1).max(60),
});
export type CreateSiteCustomFieldDefinitionInput = z.infer<typeof createSiteCustomFieldDefinitionSchema>;

export const listSiteCustomFieldDefinitionsQuerySchema = z.object({
  clientId: z.string().optional(),
});
