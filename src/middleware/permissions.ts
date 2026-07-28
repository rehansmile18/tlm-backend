import { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../utils/errors";

/**
 * The fixed, code-defined catalog of permission keys this service understands. Individually
 * assignable per user (via TLM's User.permissions — see GET /users/me) rather than a fixed
 * per-role capability set: two users with the same role can have different permissions. This is
 * the catalog itself, not who has what — see modules/permissions for the catalog + per-role
 * recommended-defaults endpoint.
 */
export const PERMISSION_KEYS = [
  "employee:read",
  "employee:write",
  "employeeGroup:read",
  "employeeGroup:write",
  "site:read",
  "site:write",
  "task:read",
  "task:write",
  "payPeriodConfig:read",
  "payPeriodConfig:write",
  "payrollCalendar:read",
  "payrollCalendar:write",
  "punch:read",
  "punch:write",
  "schedule:read",
  "schedule:write",
  "employeeSiteAssignment:read",
  "employeeSiteAssignment:write",
  "timesheet:read",
  "timesheet:void",
  "processing:trigger",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * "Can this user do this kind of thing at all" — orthogonal to and composed with tenantScope's
 * data-visibility checks ("on whose data"). PLATFORM_ADMIN always bypasses, mirroring TLM's own
 * assertCanWriteGlobal superuser-escape-hatch pattern. A synthetic PUNCH_INGEST principal (kiosk
 * key auth) never reaches routes gated by this — it only hits the punch-ingestion routes, which
 * use `authenticatePunchIngestOrUser` instead of requirePermission.
 */
export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw new ForbiddenError("Not authenticated");
    if (req.auth.role === "PLATFORM_ADMIN") return next();
    const missing = keys.filter((key) => !req.auth!.permissions.includes(key));
    if (missing.length > 0) {
      throw new ForbiddenError(`Missing required permission(s): ${missing.join(", ")}`);
    }
    next();
  };
}
