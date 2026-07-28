import { Request } from "express";
import { Types } from "mongoose";
import { ForbiddenError, BadRequestError } from "../utils/errors";

/**
 * Pure data-VISIBILITY scoping — "on whose data." Whether the caller may perform this kind of
 * action AT ALL ("can you do this") is a separate, orthogonal concern handled by
 * `requirePermission` (middleware/permissions.ts). A route composes both.
 */

/**
 * Returns the Mongo filter clause enforcing tenant isolation for read queries.
 * PLATFORM_ADMIN may optionally narrow by an explicit clientId query param;
 * every other role is hard-scoped to their own token clientId.
 */
export function getReadClientFilter(req: Request): Record<string, unknown> {
  if (!req.auth) throw new ForbiddenError("Not authenticated");
  if (req.auth.role === "PLATFORM_ADMIN") {
    const requested = req.query.clientId;
    return typeof requested === "string" ? { clientId: new Types.ObjectId(requested) } : {};
  }
  if (!req.auth.clientId) throw new ForbiddenError("Token missing clientId for non-admin role");
  return { clientId: new Types.ObjectId(req.auth.clientId) };
}

/** Same as getReadClientFilter, additionally narrowed to the caller's own managed sites for SITE_MANAGER. */
export function getReadSiteFilter(req: Request): Record<string, unknown> {
  const clientFilter = getReadClientFilter(req);
  if (req.auth?.role === "SITE_MANAGER") {
    return { ...clientFilter, siteId: { $in: req.auth.siteIds } };
  }
  return clientFilter;
}

/** Throws unless the caller's token clientId matches targetClientId (PLATFORM_ADMIN always passes). */
export function assertSameClient(req: Request, targetClientId: string): void {
  if (!req.auth) throw new ForbiddenError("Not authenticated");
  if (req.auth.role === "PLATFORM_ADMIN") return;
  if (req.auth.clientId !== targetClientId) {
    throw new ForbiddenError("Cannot access another client's resources");
  }
}

/** Additionally throws for SITE_MANAGER if targetSiteId isn't one of their managed sites. */
export function assertSameSite(req: Request, targetClientId: string, targetSiteId: string): void {
  assertSameClient(req, targetClientId);
  if (req.auth?.role === "SITE_MANAGER" && !req.auth.siteIds.includes(targetSiteId)) {
    throw new ForbiddenError("Cannot access a site outside your managed sites");
  }
}

export function requireClientId(clientId: unknown): string {
  if (typeof clientId !== "string" || !Types.ObjectId.isValid(clientId)) {
    throw new BadRequestError("A valid clientId is required");
  }
  return clientId;
}
