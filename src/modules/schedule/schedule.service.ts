import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ScheduledShift, ScheduledShiftDoc } from "../../models/scheduledShift.model";
import { EmployeeSiteAssignment } from "../../models/employeeSiteAssignment.model";
import { Punch, PunchDoc } from "../../models/punch.model";
import { BadRequestError, NotFoundError, ScheduleConflictError } from "../../utils/errors";
import { businessDateInZone } from "../../utils/time";
import { CreateScheduleInput, UpdateScheduleInput } from "./schedule.validators";

/** A shift may only be booked for an employee/site pair with an active EmployeeSiteAssignment — this is the FK check the master-data modules already do for their own cross-references. */
async function assertEmployeeSiteAssignmentActive(clientId: Types.ObjectId, employeeId: string, siteId: string): Promise<void> {
  const active = await EmployeeSiteAssignment.exists({ clientId, employeeId, siteId, status: "active" });
  if (!active) {
    throw new BadRequestError(`Employee ${employeeId} has no active site assignment for site ${siteId}`);
  }
}

/**
 * Application-level double-booking guard: reject if an existing "scheduled" shift for this
 * employee overlaps the new time range. Check-then-insert, not atomic — acceptable because this
 * is human-paced UI usage (a site manager building a roster), not a payroll-correctness race.
 */
async function assertNoOverlap(
  clientId: Types.ObjectId,
  employeeId: string,
  shiftStart: Date,
  shiftEnd: Date,
  excludeId?: Types.ObjectId
): Promise<void> {
  const query: Record<string, unknown> = {
    clientId,
    employeeId,
    status: "scheduled",
    shiftStart: { $lt: shiftEnd },
    shiftEnd: { $gt: shiftStart },
  };
  if (excludeId) query._id = { $ne: excludeId };
  const overlapping = await ScheduledShift.exists(query);
  if (overlapping) throw new ScheduleConflictError(employeeId);
}

export async function createSchedule(
  input: CreateScheduleInput,
  createdBy: string,
  seriesId: string | null = null
): Promise<ScheduledShiftDoc> {
  const clientId = new Types.ObjectId(input.clientId);
  await assertEmployeeSiteAssignmentActive(clientId, input.employeeId, input.siteId);
  await assertNoOverlap(clientId, input.employeeId, input.shiftStart, input.shiftEnd);
  return ScheduledShift.create({
    clientId,
    employeeId: input.employeeId,
    siteId: input.siteId,
    task: input.task ?? null,
    shiftStart: input.shiftStart,
    shiftEnd: input.shiftEnd,
    timezone: input.timezone,
    businessDate: businessDateInZone(input.shiftStart, input.timezone),
    status: "scheduled",
    seriesId,
    createdBy,
    notes: input.notes ?? null,
  });
}

export interface BulkCreateScheduleResult {
  accepted: ScheduledShiftDoc[];
  rejected: { index: number; error: string }[];
  seriesId: string;
}

/** Each shift is validated/created independently — one conflicting shift in a batch never fails the rest. All shifts in a batch share one seriesId. */
export async function bulkCreateSchedules(inputs: CreateScheduleInput[], createdBy: string): Promise<BulkCreateScheduleResult> {
  const seriesId = randomUUID();
  const accepted: ScheduledShiftDoc[] = [];
  const rejected: { index: number; error: string }[] = [];
  for (let index = 0; index < inputs.length; index++) {
    try {
      const doc = await createSchedule(inputs[index], createdBy, seriesId);
      accepted.push(doc);
    } catch (err) {
      rejected.push({ index, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { accepted, rejected, seriesId };
}

export async function listSchedules(
  tenantFilter: Record<string, unknown>,
  filters: { employeeId?: string; siteId?: string; status?: string; from?: Date; to?: Date },
  page: number,
  pageSize: number
) {
  const query: Record<string, unknown> = { ...tenantFilter };
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.siteId) query.siteId = filters.siteId;
  if (filters.status) query.status = filters.status;
  if (filters.from || filters.to) {
    query.shiftStart = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  const [items, total] = await Promise.all([
    ScheduledShift.find(query)
      .sort({ shiftStart: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ScheduledShift.countDocuments(query),
  ]);
  return { items, total, page, pageSize };
}

export async function getSchedule(id: string, tenantFilter: Record<string, unknown>): Promise<ScheduledShiftDoc> {
  const doc = await ScheduledShift.findOne({ _id: id, ...tenantFilter }).lean();
  if (!doc) throw new NotFoundError(`Scheduled shift ${id} not found`);
  return doc;
}

export async function updateSchedule(
  id: string,
  input: UpdateScheduleInput,
  tenantFilter: Record<string, unknown>
): Promise<ScheduledShiftDoc> {
  const doc = await ScheduledShift.findOne({ _id: id, ...tenantFilter });
  if (!doc) throw new NotFoundError(`Scheduled shift ${id} not found`);
  if (doc.status === "cancelled") throw new BadRequestError("Cannot edit a cancelled shift");

  const shiftStart = input.shiftStart ?? doc.shiftStart;
  const shiftEnd = input.shiftEnd ?? doc.shiftEnd;
  if (input.shiftStart || input.shiftEnd) {
    await assertNoOverlap(doc.clientId, doc.employeeId, shiftStart, shiftEnd, doc._id);
  }

  if (input.task !== undefined) doc.task = input.task;
  if (input.notes !== undefined) doc.notes = input.notes;
  if (input.timezone !== undefined) doc.timezone = input.timezone;
  if (input.shiftStart !== undefined) doc.shiftStart = input.shiftStart;
  if (input.shiftEnd !== undefined) doc.shiftEnd = input.shiftEnd;
  if (input.shiftStart !== undefined || input.timezone !== undefined) {
    doc.businessDate = businessDateInZone(doc.shiftStart, doc.timezone);
  }
  doc.updatedAt = new Date();

  await doc.save();
  return doc;
}

export async function cancelSchedule(id: string, tenantFilter: Record<string, unknown>): Promise<ScheduledShiftDoc> {
  const doc = await ScheduledShift.findOne({ _id: id, ...tenantFilter });
  if (!doc) throw new NotFoundError(`Scheduled shift ${id} not found`);
  doc.status = "cancelled";
  doc.updatedAt = new Date();
  await doc.save();
  return doc;
}

export type AdherenceStatus = "no_show" | "on_time" | "late" | "early";

export interface AdherenceEntry {
  shiftId: string;
  clientId: string;
  employeeId: string;
  siteId: string;
  businessDate: string;
  shiftStart: Date;
  shiftEnd: Date;
  status: AdherenceStatus;
  matchedPunchId: string | null;
  clockInVarianceMinutes: number | null;
  clockOutVarianceMinutes: number | null;
}

// A grace window either side of the scheduled shift within which a punch is still considered a
// match for it (kiosk clocks and shift boundaries are never perfectly aligned in practice).
const PUNCH_MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;
const LATE_THRESHOLD_MINUTES = 5;
const EARLY_THRESHOLD_MINUTES = 5;

/**
 * Computed on-demand, not stored — both ScheduledShift and Punch can be corrected after the fact,
 * so a cached field would need its own staleness tracking (like Timesheet's `stale` flag) for no
 * real benefit at site-manager-view scale (one site, one week — tens to low-hundreds of rows).
 */
export async function getAdherenceReport(
  tenantFilter: Record<string, unknown>,
  filters: { employeeId?: string; siteId?: string; from: Date; to: Date }
): Promise<AdherenceEntry[]> {
  const shiftQuery: Record<string, unknown> = {
    ...tenantFilter,
    status: "scheduled",
    shiftStart: { $gte: filters.from, $lte: filters.to },
  };
  if (filters.employeeId) shiftQuery.employeeId = filters.employeeId;
  if (filters.siteId) shiftQuery.siteId = filters.siteId;

  const shifts = await ScheduledShift.find(shiftQuery).sort({ shiftStart: 1 }).lean();
  if (shifts.length === 0) return [];

  const clientIds = [...new Map(shifts.map((s) => [String(s.clientId), s.clientId])).values()];
  const employeeIds = [...new Set(shifts.map((s) => s.employeeId))];
  const windowStart = new Date(Math.min(...shifts.map((s) => s.shiftStart.getTime())) - PUNCH_MATCH_WINDOW_MS);
  const windowEnd = new Date(Math.max(...shifts.map((s) => s.shiftEnd.getTime())) + PUNCH_MATCH_WINDOW_MS);
  const punches = await Punch.find({
    clientId: { $in: clientIds },
    employeeId: { $in: employeeIds },
    status: { $in: ["open", "closed"] },
    clockIn: { $gte: windowStart, $lte: windowEnd },
  }).lean();

  return shifts.map((shift) => buildAdherenceEntry(shift, punches));
}

function buildAdherenceEntry(shift: ScheduledShiftDoc, punches: PunchDoc[]): AdherenceEntry {
  const candidates = punches
    .filter(
      (p) =>
        String(p.clientId) === String(shift.clientId) &&
        p.employeeId === shift.employeeId &&
        p.siteId === shift.siteId &&
        p.clockIn.getTime() >= shift.shiftStart.getTime() - PUNCH_MATCH_WINDOW_MS &&
        p.clockIn.getTime() <= shift.shiftEnd.getTime() + PUNCH_MATCH_WINDOW_MS
    )
    .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
  const matched = candidates[0] ?? null;

  const base = {
    shiftId: String(shift._id),
    clientId: String(shift.clientId),
    employeeId: shift.employeeId,
    siteId: shift.siteId,
    businessDate: shift.businessDate,
    shiftStart: shift.shiftStart,
    shiftEnd: shift.shiftEnd,
  };

  if (!matched) {
    return { ...base, status: "no_show", matchedPunchId: null, clockInVarianceMinutes: null, clockOutVarianceMinutes: null };
  }

  const clockInVarianceMinutes = Math.round((matched.clockIn.getTime() - shift.shiftStart.getTime()) / 60_000);
  const clockOutVarianceMinutes = matched.clockOut
    ? Math.round((matched.clockOut.getTime() - shift.shiftEnd.getTime()) / 60_000)
    : null;

  let status: AdherenceStatus = "on_time";
  if (clockInVarianceMinutes > LATE_THRESHOLD_MINUTES) status = "late";
  else if (clockOutVarianceMinutes !== null && clockOutVarianceMinutes < -EARLY_THRESHOLD_MINUTES) status = "early";

  return { ...base, status, matchedPunchId: String(matched._id), clockInVarianceMinutes, clockOutVarianceMinutes };
}
