import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createScheduleSchema,
  bulkCreateScheduleSchema,
  updateScheduleSchema,
  listSchedulesQuerySchema,
  adherenceQuerySchema,
  scheduleIdParamSchema,
} from "./schedule.validators";
import {
  createScheduleHandler,
  bulkCreateSchedulesHandler,
  listSchedulesHandler,
  getScheduleHandler,
  updateScheduleHandler,
  cancelScheduleHandler,
  getAdherenceHandler,
} from "./schedule.controller";

export const scheduleRouter = Router();
scheduleRouter.use(authenticate);

// Registered before "/:id" so "bulk"/"adherence" aren't captured as an id param.
scheduleRouter.post(
  "/schedules/bulk",
  requirePermission("schedule:write"),
  validateRequest({ body: bulkCreateScheduleSchema }),
  bulkCreateSchedulesHandler
);
scheduleRouter.get(
  "/schedules/adherence",
  requirePermission("schedule:read"),
  validateRequest({ query: adherenceQuerySchema }),
  getAdherenceHandler
);

scheduleRouter.get(
  "/schedules",
  requirePermission("schedule:read"),
  validateRequest({ query: listSchedulesQuerySchema }),
  listSchedulesHandler
);
scheduleRouter.get(
  "/schedules/:id",
  requirePermission("schedule:read"),
  validateRequest({ params: scheduleIdParamSchema }),
  getScheduleHandler
);
scheduleRouter.post(
  "/schedules",
  requirePermission("schedule:write"),
  validateRequest({ body: createScheduleSchema }),
  createScheduleHandler
);
scheduleRouter.patch(
  "/schedules/:id",
  requirePermission("schedule:write"),
  validateRequest({ params: scheduleIdParamSchema, body: updateScheduleSchema }),
  updateScheduleHandler
);
scheduleRouter.post(
  "/schedules/:id/cancel",
  requirePermission("schedule:write"),
  validateRequest({ params: scheduleIdParamSchema }),
  cancelScheduleHandler
);
