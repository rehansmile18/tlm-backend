import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { getPermissionsCatalogHandler } from "./permissionsCatalog.controller";

export const permissionsCatalogRouter = Router();
permissionsCatalogRouter.use(authenticate);

// No requirePermission gate — read-only reference data any logged-in user may consult.
permissionsCatalogRouter.get("/permissions/catalog", getPermissionsCatalogHandler);
