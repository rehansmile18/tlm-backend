import { Types } from "mongoose";
import {
  SiteCustomFieldDefinition,
  SiteCustomFieldDefinitionDoc,
} from "../../models/siteCustomFieldDefinition.model";
import { CreateSiteCustomFieldDefinitionInput } from "./siteCustomFieldDefinition.validators";

export async function listSiteCustomFieldDefinitions(
  tenantFilter: Record<string, unknown>
): Promise<SiteCustomFieldDefinitionDoc[]> {
  return SiteCustomFieldDefinition.find(tenantFilter).sort({ name: 1 }).lean();
}

export async function createSiteCustomFieldDefinition(
  input: CreateSiteCustomFieldDefinitionInput
): Promise<SiteCustomFieldDefinitionDoc> {
  return SiteCustomFieldDefinition.create({
    clientId: new Types.ObjectId(input.clientId),
    name: input.name,
  });
}
