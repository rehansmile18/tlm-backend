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

export const createSiteSchema = z.object({
  clientId: z.string(),
  siteId: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  location: locationSchema.nullable().optional(),
  customFields: customFieldsSchema.nullable().optional(),
});
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

// clientId is deliberately absent — a site's tenant is fixed at creation and is not reassignable
// via PATCH (mirrors TLM's assignment/policy update schemas, which also exclude clientId).
export const updateSiteSchema = z.object({
  siteId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  location: locationSchema.nullable().optional(),
  customFields: customFieldsSchema.nullable().optional(),
});
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

export const listSitesQuerySchema = z.object({
  clientId: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const siteIdParamSchema = z.object({
  id: z.string(),
});
