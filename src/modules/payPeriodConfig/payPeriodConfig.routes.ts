import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createPayPeriodConfigSchema,
  updatePayPeriodConfigSchema,
  listPayPeriodConfigsQuerySchema,
  payPeriodConfigIdParamSchema,
} from "./payPeriodConfig.validators";
import {
  listPayPeriodConfigsHandler,
  getPayPeriodConfigHandler,
  createPayPeriodConfigHandler,
  updatePayPeriodConfigHandler,
} from "./payPeriodConfig.controller";

export const payPeriodConfigRouter = Router();
payPeriodConfigRouter.use(authenticate);

payPeriodConfigRouter.get(
  "/pay-period-configs",
  requirePermission("payPeriodConfig:read"),
  validateRequest({ query: listPayPeriodConfigsQuerySchema }),
  listPayPeriodConfigsHandler
);
payPeriodConfigRouter.get(
  "/pay-period-configs/:id",
  requirePermission("payPeriodConfig:read"),
  validateRequest({ params: payPeriodConfigIdParamSchema }),
  getPayPeriodConfigHandler
);
payPeriodConfigRouter.post(
  "/pay-period-configs",
  requirePermission("payPeriodConfig:write"),
  validateRequest({ body: createPayPeriodConfigSchema }),
  createPayPeriodConfigHandler
);
payPeriodConfigRouter.patch(
  "/pay-period-configs/:id",
  requirePermission("payPeriodConfig:write"),
  validateRequest({ params: payPeriodConfigIdParamSchema, body: updatePayPeriodConfigSchema }),
  updatePayPeriodConfigHandler
);
