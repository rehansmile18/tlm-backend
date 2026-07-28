import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permissions";
import { validateRequest } from "../../middleware/validateRequest";
import { createTaskSchema, updateTaskSchema, listTasksQuerySchema, taskIdParamSchema } from "./task.validators";
import { listTasksHandler, getTaskHandler, createTaskHandler, updateTaskHandler } from "./task.controller";

export const taskRouter = Router();
taskRouter.use(authenticate);

taskRouter.get(
  "/tasks",
  requirePermission("task:read"),
  validateRequest({ query: listTasksQuerySchema }),
  listTasksHandler
);
taskRouter.get(
  "/tasks/:id",
  requirePermission("task:read"),
  validateRequest({ params: taskIdParamSchema }),
  getTaskHandler
);
taskRouter.post(
  "/tasks",
  requirePermission("task:write"),
  validateRequest({ body: createTaskSchema }),
  createTaskHandler
);
taskRouter.patch(
  "/tasks/:id",
  requirePermission("task:write"),
  validateRequest({ params: taskIdParamSchema, body: updateTaskSchema }),
  updateTaskHandler
);
