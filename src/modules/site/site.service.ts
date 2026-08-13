import { Types } from "mongoose";
import { Site, SiteDoc } from "../../models/site.model";
import { normalizeLocationInput } from "../../models/location";
import { NotFoundError } from "../../utils/errors";
import { CreateSiteInput, UpdateSiteInput } from "./site.validators";

export async function listSites(tenantFilter: Record<string, unknown>, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    Site.find(tenantFilter)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Site.countDocuments(tenantFilter),
  ]);
  return { items, total, page, pageSize };
}

export async function getSite(id: string, tenantFilter: Record<string, unknown>) {
  const doc = await Site.findOne({ _id: id, ...tenantFilter }).lean();
  if (!doc) throw new NotFoundError(`Site ${id} not found`);
  return doc;
}

export async function createSite(input: CreateSiteInput): Promise<SiteDoc> {
  const doc = await Site.create({
    siteId: input.siteId,
    clientId: new Types.ObjectId(input.clientId),
    name: input.name,
    timezone: input.timezone,
    location: normalizeLocationInput(input.location),
    customFields: input.customFields ?? null,
  });
  return doc;
}

export async function updateSite(id: string, input: UpdateSiteInput, tenantFilter: Record<string, unknown>): Promise<SiteDoc> {
  const doc = await Site.findOne({ _id: id, ...tenantFilter });
  if (!doc) throw new NotFoundError(`Site ${id} not found`);
  const { location, customFields, ...rest } = input;
  Object.assign(doc, rest);
  if (location !== undefined) doc.location = normalizeLocationInput(location);
  if (customFields !== undefined) doc.customFields = customFields;
  doc.updatedAt = new Date();
  await doc.save();
  return doc;
}
