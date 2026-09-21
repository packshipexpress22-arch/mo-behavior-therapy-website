// Editable service-area configuration. Nothing about ZIP/county coverage is
// hard-coded into pages or the chat widget — everything reads this file, so
// adding a county or city later never requires touching component code.

export type County = {
  id: string;
  name: string;
  slug: string;
};

export type City = {
  id: string;
  name: string;
  county: string; // County id
  slug: string; // used for /service-areas/[city] and /aba-therapy/[city]-style pages
  isOfficeLocation: boolean;
};

// St. Lucie, Martin, Indian River and Palm Beach were the original primary
// counties; Hendry, Glades, Highlands and Okeechobee were added per the
// client's 2026-09-17 follow-up.
export const counties: County[] = [
  { id: "st-lucie", name: "St. Lucie County", slug: "st-lucie-county" },
  { id: "martin", name: "Martin County", slug: "martin-county" },
  { id: "indian-river", name: "Indian River County", slug: "indian-river-county" },
  { id: "palm-beach", name: "Palm Beach County", slug: "palm-beach-county" },
  { id: "hendry", name: "Hendry County", slug: "hendry-county" },
  { id: "glades", name: "Glades County", slug: "glades-county" },
  { id: "highlands", name: "Highlands County", slug: "highlands-county" },
  { id: "okeechobee", name: "Okeechobee County", slug: "okeechobee-county" },
];

export const cities: City[] = [
  { id: "port-st-lucie", name: "Port St. Lucie", county: "st-lucie", slug: "port-st-lucie", isOfficeLocation: false },
  { id: "fort-pierce", name: "Fort Pierce", county: "st-lucie", slug: "fort-pierce", isOfficeLocation: true },
  { id: "stuart", name: "Stuart", county: "martin", slug: "stuart", isOfficeLocation: false },
  { id: "vero-beach", name: "Vero Beach", county: "indian-river", slug: "vero-beach", isOfficeLocation: false },
  { id: "west-palm-beach", name: "West Palm Beach", county: "palm-beach", slug: "west-palm-beach", isOfficeLocation: false },
];

// Known ZIP prefixes used only as a soft, editable heuristic for the chat
// widget's "is this in our service area?" check. This is intentionally NOT
// authoritative — it should never hard-block a lead (see zip-lookup.ts).
export const zipRangesByCounty: Record<string, string[]> = {
  "st-lucie": ["349"],
  martin: ["334"],
  "indian-river": ["329"],
  "palm-beach": ["334", "333"],
  hendry: ["339"],
  glades: ["339"],
  highlands: ["338"],
  okeechobee: ["349"],
};

export const officeLocation = {
  label: "Fort Pierce Office",
  address: "130 S Indian River Dr, Suite 237, Fort Pierce, FL 34950",
};
