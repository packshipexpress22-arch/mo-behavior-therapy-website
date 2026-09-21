// The slot-filling state machine behind Milo. Order mirrors the sequence
// the client specified: who it's for -> contact/client details -> setting
// -> insurance -> history/documents -> contact info -> consent. Any slot
// already filled by extract.ts (because the visitor volunteered it in free
// text) is skipped — Milo never re-asks something it was already told.

export type SlotKey =
  | "whoFor"
  | "contactName"
  | "relationship"
  | "clientAge"
  | "cityZip"
  | "setting"
  | "insurance"
  | "previousAba"
  | "documents"
  | "phone"
  | "email"
  | "contactMethod"
  | "contactTime"
  | "consent";

export const SLOT_ORDER: SlotKey[] = [
  "whoFor",
  "contactName",
  "relationship",
  "clientAge",
  "cityZip",
  "setting",
  "insurance",
  "previousAba",
  "documents",
  "phone",
  "email",
  "contactMethod",
  "contactTime",
  "consent",
];

export type LeadDraft = Partial<{
  whoFor: string;
  contactName: string;
  clientFirstName: string;
  relationship: string;
  clientAge: string;
  city: string;
  zip: string;
  county: string;
  setting: string;
  insurance: string;
  previousAba: string;
  hasReferral: string;
  hasEvaluation: string;
  hasIep: string;
  phone: string;
  email: string;
  contactMethod: string;
  contactTime: string;
  message: string;
  consent: boolean;
  /** internal UI bookkeeping only — not sent to the API */
  _areaChecked: boolean;
}>;

const SLOT_TO_DRAFT_KEY: Record<SlotKey, (keyof LeadDraft)[]> = {
  whoFor: ["whoFor"],
  contactName: ["contactName"],
  relationship: ["relationship"],
  clientAge: ["clientAge"],
  cityZip: ["city", "zip"],
  setting: ["setting"],
  insurance: ["insurance"],
  previousAba: ["previousAba"],
  documents: ["hasReferral"], // documents question is a single optional bundle; hasReferral marks it as asked
  phone: ["phone"],
  email: ["email"],
  contactMethod: ["contactMethod"],
  contactTime: ["contactTime"],
  consent: ["consent"],
};

/** Returns the first slot in SLOT_ORDER that isn’t already filled. */
export function nextMissingSlot(draft: LeadDraft): SlotKey | null {
  for (const slot of SLOT_ORDER) {
    const keys = SLOT_TO_DRAFT_KEY[slot];
    const isFilled = (k: keyof LeadDraft) => {
      const v = draft[k];
      return v !== undefined && v !== null && v !== "";
    };
    // "cityZip" asks for city AND zip in one prompt, but a visitor who
    // answers with just one of them (very common — people often type only
    // their ZIP) has still answered the question. Requiring every key here
    // would leave the slot unfillable and Milo would re-ask it forever, so
    // this one slot is satisfied by any key being filled rather than all of
    // them; every other slot still requires all of its keys.
    const filled = slot === "cityZip" ? keys.some(isFilled) : keys.every(isFilled);
    if (!filled) return slot;
  }
  return null;
}

export function isComplete(draft: LeadDraft): boolean {
  return nextMissingSlot(draft) === null;
}
