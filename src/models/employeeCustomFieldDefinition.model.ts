import { Schema, Types } from "mongoose";
import { ruleRepoConnection } from "../config/db";

// A client-defined slot (just a name) that every one of that client's Employees can then set a
// value for in its own `customFields` map — mirrors Task's shape as a simple per-client catalog.
export interface EmployeeCustomFieldDefinitionDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const employeeCustomFieldDefinitionSchema = new Schema<EmployeeCustomFieldDefinitionDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "employeeCustomFieldDefinitions" }
);

employeeCustomFieldDefinitionSchema.index({ clientId: 1, name: 1 }, { unique: true });

export const EmployeeCustomFieldDefinition = ruleRepoConnection.model<EmployeeCustomFieldDefinitionDoc>(
  "EmployeeCustomFieldDefinition",
  employeeCustomFieldDefinitionSchema
);
