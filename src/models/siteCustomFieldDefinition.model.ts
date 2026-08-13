import { Schema, Types } from "mongoose";
import { ruleRepoConnection } from "../config/db";

// A client-defined slot (just a name) that every one of that client's Sites can then set a value
// for in its own `customFields` map — mirrors Task's shape as a simple per-client catalog.
export interface SiteCustomFieldDefinitionDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const siteCustomFieldDefinitionSchema = new Schema<SiteCustomFieldDefinitionDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "siteCustomFieldDefinitions" }
);

siteCustomFieldDefinitionSchema.index({ clientId: 1, name: 1 }, { unique: true });

export const SiteCustomFieldDefinition = ruleRepoConnection.model<SiteCustomFieldDefinitionDoc>(
  "SiteCustomFieldDefinition",
  siteCustomFieldDefinitionSchema
);
