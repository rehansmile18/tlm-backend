import { Schema, model, Types } from "mongoose";
import { SCHEDULE_STATUSES, ScheduleStatus } from "../types/domain";

// Lives on this service's OWN connection (not ruleRepoConnection) — operational, high-churn,
// site-ops-specific state, same reasoning that keeps Timesheet/ProcessingRun in punch-processor's
// own database rather than TLM's.
export interface ScheduledShiftDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  employeeId: string; // matches Employee.employeeId (external ref, not the Mongo _id)
  siteId: string; // matches Site.siteId
  task: string | null;
  shiftStart: Date;
  shiftEnd: Date;
  timezone: string;
  businessDate: string; // "YYYY-MM-DD", denormalized from shiftStart in `timezone` for day/roster queries
  status: ScheduleStatus;
  seriesId: string | null; // groups shifts created together via POST /schedules/bulk
  createdBy: string; // userId of whoever created this shift
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledShiftSchema = new Schema<ScheduledShiftDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true },
    employeeId: { type: String, required: true },
    siteId: { type: String, required: true },
    task: { type: String, default: null },
    shiftStart: { type: Date, required: true },
    shiftEnd: { type: Date, required: true },
    timezone: { type: String, required: true },
    businessDate: { type: String, required: true },
    status: { type: String, enum: SCHEDULE_STATUSES, required: true, default: "scheduled" },
    seriesId: { type: String, default: null },
    createdBy: { type: String, required: true },
    notes: { type: String, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "scheduledShifts" }
);

scheduledShiftSchema.index({ clientId: 1, employeeId: 1, shiftStart: 1 });
scheduledShiftSchema.index({ clientId: 1, siteId: 1, businessDate: 1 });
scheduledShiftSchema.index({ seriesId: 1 }, { sparse: true });

export const ScheduledShift = model<ScheduledShiftDoc>("ScheduledShift", scheduledShiftSchema);
