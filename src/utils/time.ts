import { formatInTimeZone } from "date-fns-tz";

/** The calendar date (in the given timezone) that an instant falls on — ported from tlm-punch-processor's identical utility. */
export function businessDateInZone(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}
