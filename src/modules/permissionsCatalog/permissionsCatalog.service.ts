import { PERMISSION_KEYS, PermissionKey } from "../../middleware/permissions";
import { UserRole } from "../../types/domain";

/**
 * Reference data only — nothing here is enforced. requirePermission checks a user's own
 * User.permissions array (set explicitly at create/edit time, see TLM's PATCH /users/:id); this
 * catalog just gives whatever creates/edits users (a seed script today, an admin UI later) one
 * place to consult instead of hardcoding the key list or guessing sensible per-role defaults.
 */
const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "employee:read": "View employee records",
  "employee:write": "Create and edit employee records",
  "employeeGroup:read": "View employee groups",
  "employeeGroup:write": "Create and edit employee groups",
  "site:read": "View sites",
  "site:write": "Create and edit sites",
  "task:read": "View tasks",
  "task:write": "Create and edit tasks",
  "payPeriodConfig:read": "View pay period configurations",
  "payPeriodConfig:write": "Create and edit pay period configurations",
  "payrollCalendar:read": "View payroll calendars",
  "payrollCalendar:write": "Create and edit payroll calendars",
  "punch:read": "View raw punch (timecard) records",
  "punch:write": "Submit and correct punches",
  "schedule:read": "View scheduled shifts and the adherence report",
  "schedule:write": "Create, edit, cancel, and bulk-create scheduled shifts",
  "employeeSiteAssignment:read": "View which sites an employee is assigned to",
  "employeeSiteAssignment:write": "Assign and unassign employees to/from sites",
  "timesheet:read": "View calculated timesheets and their audit trail",
  "timesheet:void": "Void a finalized timesheet",
  "processing:trigger": "Trigger payroll processing for one or more employees",
};

// PLATFORM_ADMIN and PUNCH_INGEST bypass requirePermission entirely (see middleware/permissions.ts
// and punch.routes.ts) — their User.permissions array is never consulted, so no default is
// recommended for either.
const RECOMMENDED_DEFAULTS: Record<UserRole, PermissionKey[]> = {
  PLATFORM_ADMIN: [],
  PUNCH_INGEST: [],
  // Full administrative access within their own client.
  CLIENT_ADMIN: [...PERMISSION_KEYS],
  // Read-only across every resource.
  VIEWER: PERMISSION_KEYS.filter((key) => key.endsWith(":read")),
  // Day-to-day site operations: read the master config data their site depends on, manage their
  // own site's roster/schedule, submit and correct punches, view (but not void) timesheets.
  // Voiding a finalized timesheet and triggering payroll processing are left to CLIENT_ADMIN.
  SITE_MANAGER: [
    "employee:read",
    "employeeGroup:read",
    "site:read",
    "task:read",
    "payPeriodConfig:read",
    "payrollCalendar:read",
    "punch:read",
    "punch:write",
    "schedule:read",
    "schedule:write",
    "employeeSiteAssignment:read",
    "employeeSiteAssignment:write",
    "timesheet:read",
  ],
};

export interface PermissionsCatalog {
  keys: { key: PermissionKey; description: string }[];
  recommendedDefaults: Record<UserRole, PermissionKey[]>;
}

export function getPermissionsCatalog(): PermissionsCatalog {
  return {
    keys: PERMISSION_KEYS.map((key) => ({ key, description: PERMISSION_DESCRIPTIONS[key] })),
    recommendedDefaults: RECOMMENDED_DEFAULTS,
  };
}
