import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertSameClient } from "../../middleware/tenantScope";
import * as siteCustomFieldDefinitionService from "./siteCustomFieldDefinition.service";
import { CreateSiteCustomFieldDefinitionInput } from "./siteCustomFieldDefinition.validators";

export const listSiteCustomFieldDefinitionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const items = await siteCustomFieldDefinitionService.listSiteCustomFieldDefinitions(getReadClientFilter(req));
  res.json({ items });
});

export const createSiteCustomFieldDefinitionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateSiteCustomFieldDefinitionInput;
  assertSameClient(req, input.clientId);
  const doc = await siteCustomFieldDefinitionService.createSiteCustomFieldDefinition(input);
  res.status(201).json(doc);
});
