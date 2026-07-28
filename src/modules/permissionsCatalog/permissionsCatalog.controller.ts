import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getPermissionsCatalog } from "./permissionsCatalog.service";

export const getPermissionsCatalogHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(getPermissionsCatalog());
});
