import { zipRangesByCounty, counties } from "@/data/serviceAreas";

/**
 * Soft, editable heuristic only — per spec this must NEVER hard-block a
 * lead. An "outside area" result still lets the visitor submit; it just
 * changes the assistant's wording (see chat.prompts.outsideServiceArea).
 */
export function isLikelyInServiceArea(zip: string): { inArea: boolean; countyName?: string } {
  const prefix = zip.slice(0, 3);
  for (const [countyId, prefixes] of Object.entries(zipRangesByCounty)) {
    if (prefixes.includes(prefix)) {
      const county = counties.find((c) => c.id === countyId);
      return { inArea: true, countyName: county?.name };
    }
  }
  return { inArea: false };
}
