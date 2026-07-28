import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import { createSiteSchema, updateSiteSchema, listSitesQuerySchema, siteIdParamSchema } from "./site.validators";
import { listSitesHandler, getSiteHandler, createSiteHandler, updateSiteHandler } from "./site.controller";

export const siteRouter = Router();
siteRouter.use(authenticate);

siteRouter.get(
  "/sites",
  requirePermission("site:read"),
  validateRequest({ query: listSitesQuerySchema }),
  listSitesHandler
);
siteRouter.get(
  "/sites/:id",
  requirePermission("site:read"),
  validateRequest({ params: siteIdParamSchema }),
  getSiteHandler
);
siteRouter.post(
  "/sites",
  requirePermission("site:write"),
  validateRequest({ body: createSiteSchema }),
  createSiteHandler
);
siteRouter.patch(
  "/sites/:id",
  requirePermission("site:write"),
  validateRequest({ params: siteIdParamSchema, body: updateSiteSchema }),
  updateSiteHandler
);
