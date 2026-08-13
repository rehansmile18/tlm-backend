import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertSameClient } from "../../middleware/tenantScope";
import * as employeeCustomFieldDefinitionService from "./employeeCustomFieldDefinition.service";
import { CreateEmployeeCustomFieldDefinitionInput } from "./employeeCustomFieldDefinition.validators";

export const listEmployeeCustomFieldDefinitionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const items = await employeeCustomFieldDefinitionService.listEmployeeCustomFieldDefinitions(
    getReadClientFilter(req)
  );
  res.json({ items });
});

export const createEmployeeCustomFieldDefinitionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateEmployeeCustomFieldDefinitionInput;
  assertSameClient(req, input.clientId);
  const doc = await employeeCustomFieldDefinitionService.createEmployeeCustomFieldDefinition(input);
  res.status(201).json(doc);
});
