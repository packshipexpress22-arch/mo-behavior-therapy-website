// Single source of truth for company facts. Everything here is real,
// client-provided information — do not add anything (awards, stats, years
// of experience, additional offices) that hasn't been explicitly confirmed.

export const company = {
  legalName: "MO Behavior Therapy LLC",
  shortName: "MO Behavior Therapy",
  tagline: {
    en: "Building Brighter Futures, One Child at a Time.",
    es: "Construyendo futuros más brillantes, un niño a la vez.",
    ht: "Bati Yon Fiti Pi Klere, Yon Timoun Alafwa.",
    pt: "Construindo Futuros Mais Brilhantes, Uma Criança de Cada Vez.",
    fr: "Bâtir des avenirs plus lumineux, un enfant à la fois.",
    de: "Wir gestalten hellere Zukunftsaussichten, ein Kind nach dem anderen.",
  },
  positioning: {
    en: "Clinical Excellence. Family-Centered Care.",
    es: "Excelencia clínica. Atención centrada en la familia.",
    ht: "Ekselans Klinik. Swen Santre sou Fanmi.",
    pt: "Excelência Clínica. Cuidado Centrado na Família.",
    fr: "Excellence clinique. Des soins centrés sur la famille.",
    de: "Klinische Exzellenz. Familienorientierte Betreuung.",
  },
  address: {
    line1: "130 S Indian River Dr, Suite 237",
    city: "Fort Pierce",
    state: "FL",
    zip: "34950",
    country: "US",
  },
  phone: {
    display: "(305) 795-0600",
    e164: "+13057950600",
  },
  fax: "(772) 872-3295",
  email: "mobehavior@mobehaviortherapy.com",
  domain: "mobehaviortherapy.com",
  npi: "1457196420",
  hours: [{ days: "Monday–Friday", hours: "8:30 AM–5:00 PM" }],
  leadership: [
    {
      name: "Mauricio Garcia Losada, M.S., BCBA",
      title: "Lead Analyst",
      bio: null, // Intentionally empty — do not invent a biography. Fill in via admin/CMS when provided.
    },
  ],
  social: {
    // Fill in once official handles are confirmed.
    facebook: "",
    instagram: "",
  },
} as const;
