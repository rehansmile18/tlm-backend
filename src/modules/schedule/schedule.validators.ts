import { z } from "zod";

const scheduleFields = {
  clientId: z.string(),
  employeeId: z.string().min(1),
  siteId: z.string().min(1),
  task: z.string().min(1).nullable().optional(),
  shiftStart: z.coerce.date(),
  shiftEnd: z.coerce.date(),
  timezone: z.string().min(1),
  notes: z.string().nullable().optional(),
};

function refineShiftEndAfterShiftStart<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const value = data as { shiftStart?: Date; shiftEnd?: Date };
    if (value.shiftStart && value.shiftEnd && value.shiftEnd.getTime() <= value.shiftStart.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "shiftEnd must be after shiftStart", path: ["shiftEnd"] });
    }
  });
}

export const createScheduleSchema = refineShiftEndAfterShiftStart(z.object(scheduleFields));
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const bulkCreateScheduleSchema = z.object({
  shifts: z.array(z.object(scheduleFields)).min(1).max(1000),
});
export type BulkCreateScheduleInput = z.infer<typeof bulkCreateScheduleSchema>;

// clientId/employeeId/siteId cannot change — reassigning a shift to a different employee or site
// is a new shift, not a correction. Cancellation is its own dedicated endpoint, not a status patch.
export const updateScheduleSchema = refineShiftEndAfterShiftStart(
  z.object({
    task: z.string().min(1).nullable().optional(),
    shiftStart: z.coerce.date().optional(),
    shiftEnd: z.coerce.date().optional(),
    timezone: z.string().min(1).optional(),
    notes: z.string().nullable().optional(),
  })
);
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const listSchedulesQuerySchema = z.object({
  clientId: z.string().optional(),
  employeeId: z.string().optional(),
  siteId: z.string().optional(),
  status: z.enum(["scheduled", "cancelled"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const adherenceQuerySchema = z.object({
  clientId: z.string().optional(),
  employeeId: z.string().optional(),
  siteId: z.string().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const scheduleIdParamSchema = z.object({ id: z.string() });
