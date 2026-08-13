import { Schema } from "mongoose";

// Shared by Site and Employee — a plain postal address, all fields optional since it's an
// additive field on records that existed long before it did.
export interface Location {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null; // ISO-3166-2 subdivision code, e.g. "CA"
  country: string | null; // ISO-3166-1 alpha-2 code, e.g. "US"
  postalCode: string | null;
}

export const locationSchema = new Schema<Location>(
  {
    addressLine1: { type: String, default: null },
    addressLine2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    postalCode: { type: String, default: null },
  },
  { _id: false }
);

// Zod's .nullable().optional() sub-fields infer as `string | null | undefined`, but a stored
// Location always has every key present (`string | null`) — this fills in any omitted sub-field
// as null so a partial input object still produces a well-formed Location.
export type LocationInput = Partial<Record<keyof Location, string | null | undefined>> | null | undefined;

export function normalizeLocationInput(input: LocationInput): Location | null {
  if (!input) return null;
  return {
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    postalCode: input.postalCode ?? null,
  };
}
