import { Schema, Types } from "mongoose";
import { ruleRepoConnection } from "../config/db";

export interface EmployeeSiteAssignmentDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  employeeId: string; // matches Employee.employeeId (external ref, not the Mongo _id)
  siteId: string; // matches Site.siteId
  isPrimary: boolean;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const employeeSiteAssignmentSchema = new Schema<EmployeeSiteAssignmentDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true },
    employeeId: { type: String, required: true },
    siteId: { type: String, required: true },
    isPrimary: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ["active", "inactive"], required: true, default: "active" },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "employeeSiteAssignments" }
);

employeeSiteAssignmentSchema.index({ clientId: 1, employeeId: 1, siteId: 1 }, { unique: true });
employeeSiteAssignmentSchema.index({ clientId: 1, siteId: 1, status: 1 });
// Partial unique index: at most one primary site per employee, but only while isPrimary=true —
// this lets every non-primary assignment coexist without tripping the constraint.
employeeSiteAssignmentSchema.index(
  { clientId: 1, employeeId: 1, isPrimary: 1 },
  { unique: true, partialFilterExpression: { isPrimary: true } }
);

export const EmployeeSiteAssignment = ruleRepoConnection.model<EmployeeSiteAssignmentDoc>(
  "EmployeeSiteAssignment",
  employeeSiteAssignmentSchema
);
