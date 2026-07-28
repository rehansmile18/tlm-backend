import { UserRole } from "./domain";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        clientId: string | null;
        // Only meaningful for SITE_MANAGER — empty for every other role. Matches Site.siteId
        // (an external string id), not a local ObjectId.
        siteIds: string[];
        // Opaque capability keys this service defines/enforces (see middleware/permissions.ts).
        // PLATFORM_ADMIN bypasses requirePermission checks regardless of this array's contents.
        permissions: string[];
      };
    }
  }
}

export {};
