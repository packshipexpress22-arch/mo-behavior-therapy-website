// Central insurance config. The homepage / insurance page / chat widget all
// read from this file — adding a payer later is a one-object edit here,
// never a hunt through components.
//
// "primary: true" plans are the 5 confirmed on the official flyer and are
// the ones shown prominently by default, per the client's explicit
// instruction: show exactly these five now, with a "don't see yours? contact
// us" fallback underneath so the page never reads as a hard limit of five.

export type InsurancePlan = {
  id: string;
  name: string;
  slug: string;
  primary: boolean;
  notes?: string;
};

export const insurancePlans: InsurancePlan[] = [
  { id: "aetna", name: "Aetna", slug: "aetna-aba", primary: true },
  { id: "florida-blue", name: "Florida Blue", slug: "florida-blue-aba", primary: true },
  {
    id: "simply-healthcare",
    name: "Simply Healthcare",
    slug: "simply-healthcare-aba",
    primary: true,
    notes: "A Centene Behavioral Health company, where applicable.",
  },
  { id: "unitedhealthcare", name: "UnitedHealthcare", slug: "unitedhealthcare-aba", primary: true },
  { id: "cigna", name: "Cigna", slug: "cigna-aba", primary: true },
];

// Options offered inside chat / lead forms — broader than the homepage
// display list, so a family with a less-common plan can still self-identify.
export const insuranceSelectOptions = [
  ...insurancePlans.map((p) => p.name),
  "Humana",
  "Community Care Plan",
  "Sunshine Health / Lucet",
  "Children's Medical Services (CMS)",
  "Oscar",
  "Curative",
  "Other",
  "Self-pay / Unsure",
];

export const insuranceDisclaimer = {
  en: "Insurance participation and benefits vary by plan. Our team can help verify eligibility and behavioral health benefits before services begin.",
  es: "La participación del seguro y los beneficios varían según el plan. Nuestro equipo puede ayudarle a verificar la elegibilidad y los beneficios de salud conductual antes de comenzar los servicios.",
  ht: "Patisipasyon nan asirans ak benefis yo varye selon plan an. Ekip nou an ka ede verifye elijibilite ak benefis sante konpòtman anvan sèvis yo kòmanse.",
  pt: "A participação do seguro e os benefícios variam de acordo com o plano. Nossa equipe pode ajudar a verificar a elegibilidade e os benefícios de saúde comportamental antes do início dos serviços.",
  fr: "La participation à l'assurance et les prestations varient selon le régime. Notre équipe peut vous aider à vérifier l'éligibilité et les prestations de santé comportementale avant le début des services.",
  de: "Die Versicherungsteilnahme und die Leistungen variieren je nach Tarif. Unser Team hilft Ihnen gerne, die Anspruchsberechtigung und die Leistungen für Verhaltensgesundheit zu prüfen, bevor die Leistungen beginnen.",
};

export const insuranceNotListed = {
  en: "Don't see your insurance? Contact us to verify your benefits.",
  es: "¿No ve su seguro en la lista? Contáctenos para verificar sus beneficios.",
  ht: "Ou pa wè asirans ou a? Kontakte nou pou verifye benefis ou.",
  pt: "Não vê o seu plano de saúde na lista? Entre em contato para verificarmos os seus benefícios.",
  fr: "Vous ne voyez pas votre assurance ? Contactez-nous pour vérifier vos prestations.",
  de: "Ihre Versicherung ist nicht aufgeführt? Kontaktieren Sie uns, um Ihre Leistungen zu prüfen.",
};
