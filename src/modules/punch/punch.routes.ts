import { NextFunction, Request, Response, Router } from "express";
import { authenticatePunchIngestOrUser } from "../../middleware/punchIngestAuth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createPunchSchema,
  bulkCreatePunchSchema,
  correctPunchSchema,
  listPunchesQuerySchema,
  punchIdParamSchema,
} from "./punch.validators";
import {
  createPunchHandler,
  bulkCreatePunchesHandler,
  listPunchesHandler,
  getPunchHandler,
  correctPunchHandler,
} from "./punch.controller";

/**
 * A PUNCH_INGEST credential has no permissions array (it's a fixed kiosk key, not a
 * permission-bearing human user) — requirePermission would always reject it. This wrapper skips
 * the permission gate ONLY for that synthetic role, local to the two ingestion routes (create,
 * bulk create); every read/correct route below still requires punch:read/punch:write normally,
 * which naturally rejects PUNCH_INGEST since it has no permissions to check against.
 */
function allowIngestOrRequirePermission(...keys: Parameters<typeof requirePermission>) {
  const gate = requirePermission(...keys);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.auth?.role === "PUNCH_INGEST") return next();
    gate(req, res, next);
  };
}

export const punchRouter = Router();
// Every punch route accepts EITHER a punch-ingest key (kiosk/upstream systems) OR a normal
// human TLM-issued JWT — see middleware/punchIngestAuth.ts for the fallback logic.
punchRouter.use(authenticatePunchIngestOrUser);

// Registered before "/:id" so "bulk" isn't captured as an id param.
punchRouter.post(
  "/punches/bulk",
  allowIngestOrRequirePermission("punch:write"),
  validateRequest({ body: bulkCreatePunchSchema }),
  bulkCreatePunchesHandler
);

punchRouter.get(
  "/punches",
  requirePermission("punch:read"),
  validateRequest({ query: listPunchesQuerySchema }),
  listPunchesHandler
);
punchRouter.get(
  "/punches/:id",
  requirePermission("punch:read"),
  validateRequest({ params: punchIdParamSchema }),
  getPunchHandler
);
punchRouter.post(
  "/punches",
  allowIngestOrRequirePermission("punch:write"),
  validateRequest({ body: createPunchSchema }),
  createPunchHandler
);
punchRouter.patch(
  "/punches/:id",
  requirePermission("punch:write"),
  validateRequest({ params: punchIdParamSchema, body: correctPunchSchema }),
  correctPunchHandler
);
