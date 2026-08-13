import { Types } from "mongoose";
import { Employee, EmployeeDoc } from "../../models/employee.model";
import { Site } from "../../models/site.model";
import { Task } from "../../models/task.model";
import { EmployeeSiteAssignment, EmployeeSiteAssignmentDoc } from "../../models/employeeSiteAssignment.model";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { CreateEmployeeSiteAssignmentInput, UpdateEmployeeSiteAssignmentInput } from "./employeeSiteAssignment.validators";

export async function getEmployeeInScope(employeeMongoId: string, tenantFilter: Record<string, unknown>): Promise<EmployeeDoc> {
  const employee = await Employee.findOne({ _id: employeeMongoId, ...tenantFilter }).lean();
  if (!employee) throw new NotFoundError(`Employee ${employeeMongoId} not found`);
  return employee;
}

/** Mirrors employee.service.ts's FK-ownership-check idiom: a site assignment may only point at a site owned by the SAME client as the employee. */
async function assertSiteOwnedByClient(clientId: Types.ObjectId, siteId: string): Promise<void> {
  const owned = await Site.exists({ siteId, clientId });
  if (!owned) {
    throw new BadRequestError(`siteId ${siteId} does not resolve to a site owned by this client`);
  }
}

/** Same FK-ownership idiom as the site check above: the task named must be one this client actually has in its Task catalog. */
async function assertTaskOwnedByClient(clientId: Types.ObjectId, task: string): Promise<void> {
  const owned = await Task.exists({ name: task, clientId });
  if (!owned) {
    throw new BadRequestError(`task "${task}" does not resolve to a task owned by this client`);
  }
}

export async function listSitesForEmployee(
  employeeMongoId: string,
  tenantFilter: Record<string, unknown>
): Promise<EmployeeSiteAssignmentDoc[]> {
  const employee = await getEmployeeInScope(employeeMongoId, tenantFilter);
  return EmployeeSiteAssignment.find({ clientId: employee.clientId, employeeId: employee.employeeId }).lean();
}

export async function assignEmployeeToSite(
  employee: EmployeeDoc,
  input: CreateEmployeeSiteAssignmentInput
): Promise<EmployeeSiteAssignmentDoc> {
  await assertSiteOwnedByClient(employee.clientId, input.siteId);
  await assertTaskOwnedByClient(employee.clientId, input.task);
  return EmployeeSiteAssignment.create({
    clientId: employee.clientId,
    employeeId: employee.employeeId,
    siteId: input.siteId,
    task: input.task,
    isPrimary: input.isPrimary ?? false,
    status: input.status ?? "active",
  });
}

export async function updateEmployeeSiteAssignment(
  employee: EmployeeDoc,
  siteId: string,
  patch: UpdateEmployeeSiteAssignmentInput
): Promise<EmployeeSiteAssignmentDoc> {
  const assignment = await EmployeeSiteAssignment.findOne({
    clientId: employee.clientId,
    employeeId: employee.employeeId,
    siteId,
  });
  if (!assignment) {
    throw new NotFoundError(`No site assignment for employee ${employee.employeeId} and site ${siteId}`);
  }
  if (patch.task !== undefined) {
    await assertTaskOwnedByClient(employee.clientId, patch.task);
    assignment.task = patch.task;
  }
  if (patch.isPrimary !== undefined) assignment.isPrimary = patch.isPrimary;
  if (patch.status !== undefined) assignment.status = patch.status;
  assignment.updatedAt = new Date();
  await assignment.save();
  return assignment;
}

export async function unassignEmployeeFromSite(employee: EmployeeDoc, siteId: string): Promise<void> {
  const result = await EmployeeSiteAssignment.deleteOne({
    clientId: employee.clientId,
    employeeId: employee.employeeId,
    siteId,
  });
  if (result.deletedCount === 0) {
    throw new NotFoundError(`No site assignment for employee ${employee.employeeId} and site ${siteId}`);
  }
}
