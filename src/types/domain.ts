// Same three human roles as TLM, plus SITE_MANAGER (scoped to specific sites via
// User.siteIds in TLM), plus PUNCH_INGEST — a narrow role for kiosk/upstream time-clock
// credentials that may only submit punches, never touch employee/site/schedule configuration.
export const USER_ROLES = ["PLATFORM_ADMIN", "CLIENT_ADMIN", "VIEWER", "SITE_MANAGER", "PUNCH_INGEST"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CADENCES = ["daily", "weekly", "biweekly", "semi_monthly", "monthly", "salaried"] as const;
export type Cadence = (typeof CADENCES)[number];

export const PAY_DATE_WEEKEND_RULES = ["none", "prior_business_day", "next_business_day"] as const;
export type PayDateWeekendRule = (typeof PAY_DATE_WEEKEND_RULES)[number];

// Mirrors tlm-punch-processor's own src/types/domain.ts — used to type the Timesheet-proxy and
// processing-trigger-proxy responses this service passes through from punch-processor.
export const TIMESHEET_STATUSES = ["draft", "completed", "superseded", "voided", "failed"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const PROCESSING_ITEM_STATUSES = ["completed", "skipped_locked", "failed"] as const;
export type ProcessingItemStatus = (typeof PROCESSING_ITEM_STATUSES)[number];

export const SCHEDULE_STATUSES = ["scheduled", "cancelled"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
