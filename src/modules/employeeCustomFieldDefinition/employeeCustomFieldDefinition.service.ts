import { Types } from "mongoose";
import {
  EmployeeCustomFieldDefinition,
  EmployeeCustomFieldDefinitionDoc,
} from "../../models/employeeCustomFieldDefinition.model";
import { CreateEmployeeCustomFieldDefinitionInput } from "./employeeCustomFieldDefinition.validators";

export async function listEmployeeCustomFieldDefinitions(
  tenantFilter: Record<string, unknown>
): Promise<EmployeeCustomFieldDefinitionDoc[]> {
  return EmployeeCustomFieldDefinition.find(tenantFilter).sort({ name: 1 }).lean();
}

export async function createEmployeeCustomFieldDefinition(
  input: CreateEmployeeCustomFieldDefinitionInput
): Promise<EmployeeCustomFieldDefinitionDoc> {
  return EmployeeCustomFieldDefinition.create({
    clientId: new Types.ObjectId(input.clientId),
    name: input.name,
  });
}
