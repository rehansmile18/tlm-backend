import { Schema, Types } from "mongoose";
import { ruleRepoConnection } from "../config/db";
import { Location, locationSchema } from "./location";

export interface SiteDoc {
  _id: Types.ObjectId;
  siteId: string; // external reference id used as Assignment targetType=LOCATION's targetIds value in TLM
  clientId: Types.ObjectId;
  name: string;
  timezone: string; // fallback when a punch omits its own timezone
  location: Location | null;
  customFields: Record<string, string> | null; // keyed by this client's SiteCustomFieldDefinition.name
  createdAt: Date;
  updatedAt: Date;
}

const siteSchema = new Schema<SiteDoc>(
  {
    siteId: { type: String, required: true, trim: true },
    clientId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    timezone: { type: String, required: true },
    location: { type: locationSchema, default: null },
    customFields: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "sites" }
);

siteSchema.index({ clientId: 1, siteId: 1 }, { unique: true });

export const Site = ruleRepoConnection.model<SiteDoc>("Site", siteSchema);
