import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createSiteCustomFieldDefinitionSchema,
  listSiteCustomFieldDefinitionsQuerySchema,
} from "./siteCustomFieldDefinition.validators";
import {
  listSiteCustomFieldDefinitionsHandler,
  createSiteCustomFieldDefinitionHandler,
} from "./siteCustomFieldDefinition.controller";

export const siteCustomFieldDefinitionRouter = Router();
siteCustomFieldDefinitionRouter.use(authenticate);

siteCustomFieldDefinitionRouter.get(
  "/site-custom-fields",
  requirePermission("site:read"),
  validateRequest({ query: listSiteCustomFieldDefinitionsQuerySchema }),
  listSiteCustomFieldDefinitionsHandler
);
siteCustomFieldDefinitionRouter.post(
  "/site-custom-fields",
  requirePermission("site:write"),
  validateRequest({ body: createSiteCustomFieldDefinitionSchema }),
  createSiteCustomFieldDefinitionHandler
);
