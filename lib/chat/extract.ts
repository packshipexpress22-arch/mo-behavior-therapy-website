// Deterministic, regex-based entity extraction for Milo, the intake
// assistant. This is what lets a visitor type something like:
//
//   "Hola, vivo en 34953, mi hijo tiene 6 años y tiene Florida Blue"
//
// and have Milo recognize ZIP=34953, age=6, insurance=Florida Blue,
// relationship=parent — then ask ONLY for what's still missing, exactly as
// the client's brief specifies. It works without any external API, so the
// assistant is fully functional with zero configuration; if ANTHROPIC_API_KEY
// is set, lib/chat/respond.ts also uses the model for open-ended questions,
// but slot extraction always runs through here first because it's cheaper,
// deterministic, and doesn't depend on an external call succeeding.

import { insuranceSelectOptions } from "@/data/insurance";
import { cities } from "@/data/serviceAreas";
import type { Locale } from "@/i18n";

export type ExtractedFields = {
  zip?: string;
  city?: string;
  age?: string;
  insurance?: string;
  phone?: string;
  email?: string;
  relationship?: string;
  setting?: "Home" | "School" | "Community";
  name?: string;
};

const ZIP_RE = /\b(3[0-4]\d{3})\b/; // Florida ZIP codes start with 32-34
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

// "my son/daughter is 6", "mi hijo tiene 6 años", "mwen gen yon pitit ki gen 6 an", etc.
const AGE_RE =
  /\b(\d{1,2})\s*(?:years? old|yo|y\.?o\.?|años?|an(?:s|ye)?|anos?|jahre?|ane)\b|\b(?:tiene|has|gen|a)\s*(\d{1,2})\s*(?:años?|years?|an(?:s|ye)?|anos?|jahre?)?\b/i;

const RELATIONSHIP_KEYWORDS: Record<string, RegExp> = {
  Parent: /\b(mi hijo|mi hija|my son|my daughter|pitit mwen|mon fils|ma fille|meu filho|minha filha|mein sohn|meine tochter|my child|mi niño|mi niña)\b/i,
  Self: /\b(for myself|para mí|pou mwen menm|pour moi[- ]même|para mim mesmo|für mich selbst)\b/i,
  Guardian: /\b(guardian|tutor|gadyen|tuteur|tutela|vormund)\b/i,
  Caregiver: /\b(caregiver|cuidador|moun k ap pran swen|aidant|cuidador\(a\)|betreuungsperson)\b/i,
};

const SETTING_KEYWORDS: Record<ExtractedFields["setting"] & string, RegExp> = {
  Home: /\b(home|hogar|casa|kay|domicile|zuhause)\b/i,
  School: /\b(school|escuela|lekòl|école|escola|schule)\b/i,
  Community: /\b(community|comunidad|kominote|communauté|comunidade|gemeinde)\b/i,
};

export function extractFields(message: string, locale: Locale = "en"): ExtractedFields {
  const result: ExtractedFields = {};

  const zipMatch = message.match(ZIP_RE);
  if (zipMatch) result.zip = zipMatch[1];

  const emailMatch = message.match(EMAIL_RE);
  if (emailMatch) result.email = emailMatch[0];

  const phoneMatch = message.match(PHONE_RE);
  if (phoneMatch) result.phone = phoneMatch[0].trim();

  const ageMatch = message.match(AGE_RE);
  if (ageMatch) result.age = ageMatch[1] || ageMatch[2];

  for (const plan of insuranceSelectOptions) {
    if (plan === "Other" || plan === "Self-pay / Unsure") continue;
    const escaped = plan.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(message)) {
      result.insurance = plan;
      break;
    }
  }

  for (const city of cities) {
    if (new RegExp(`\\b${city.name.replace(/\./g, "\\.?")}\\b`, "i").test(message)) {
      result.city = city.name;
      break;
    }
  }

  for (const [rel, re] of Object.entries(RELATIONSHIP_KEYWORDS)) {
    if (re.test(message)) {
      result.relationship = rel;
      break;
    }
  }

  for (const [setting, re] of Object.entries(SETTING_KEYWORDS) as [
    ExtractedFields["setting"] & string,
    RegExp
  ][]) {
    if (re.test(message)) {
      result.setting = setting;
      break;
    }
  }

  // "my name is Maria" / "me llamo Maria" / "soy Maria"
  const nameMatch = message.match(
    /\b(?:my name is|me llamo|mwen rele|je m'appelle|meu nome é|ich heiße|soy|i'?m)\s+([A-ZÀ-Ý][a-zà-ÿ]+)\b/i
  );
  if (nameMatch) result.name = nameMatch[1];

  return result;
}

export function isEmergencyMessage(message: string): boolean {
  return /\b(suicide|kill myself|self[- ]?harm|emergency|911|overdose|emergencia|suicidio|urgencia|ijans|ürgence|urgence|notfall|selbstmord)\b/i.test(
    message
  );
}
