import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import { createProcessingRunSchema } from "./processingProxy.validators";
import { createProcessingRunHandler } from "./processingProxy.controller";

export const processingProxyRouter = Router();
processingProxyRouter.use(authenticate);

processingProxyRouter.post(
  "/processing/runs",
  requirePermission("processing:trigger"),
  validateRequest({ body: createProcessingRunSchema }),
  createProcessingRunHandler
);
