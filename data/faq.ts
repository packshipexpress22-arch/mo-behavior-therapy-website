// FAQ content lives here as translation KEYS ONLY — actual copy is in
// messages/*.json under "faq.items.<id>.question" / ".answer" so every
// language stays complete. This file just fixes the display order and
// which entries get FAQ structured data.
export const faqOrder = [
  "whatIsAba",
  "howToKnowIfAppropriate",
  "diagnosisRequired",
  "insuranceCoverage",
  "whichPlans",
  "howVerificationWorks",
  "whereProvided",
  "schoolBased",
  "homeBased",
  "parentTraining",
  "whatHappensAtAssessment",
  "howQuicklyCanStart",
  "documentsNeeded",
  "pediatricianReferral",
  "areasServed",
  "spanishServices",
  "howToRequestServices",
] as const;
