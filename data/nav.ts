// Primary navigation, driven by translation keys (see messages/*.json ->
// "nav.*") rather than hard-coded label strings, so every locale stays in
// sync automatically.

export type NavItem = {
  key: string; // messages nav.<key>
  href: string;
};

export const primaryNav: NavItem[] = [
  { key: "services", href: "/services" },
  { key: "howAbaWorks", href: "/aba-therapy" },
  { key: "insurance", href: "/insurance" },
  { key: "serviceAreas", href: "/service-areas" },
  { key: "forFamilies", href: "/where-we-provide-services" },
  { key: "forProviders", href: "/referral-sources" },
  { key: "careers", href: "/careers" },
  { key: "about", href: "/about" },
];

export const footerNav = {
  services: [
    { key: "abaTherapy", href: "/aba-therapy" },
    { key: "services", href: "/services" },
    { key: "parentTraining", href: "/parent-caregiver-training" },
    { key: "whereWeServe", href: "/where-we-provide-services" },
  ],
  company: [
    { key: "about", href: "/about" },
    { key: "serviceAreas", href: "/service-areas" },
    { key: "careers", href: "/careers" },
    { key: "faq", href: "/faq" },
    { key: "contact", href: "/contact" },
  ],
  forProfessionals: [
    { key: "referralSources", href: "/referral-sources" },
    { key: "insurance", href: "/insurance" },
  ],
  legal: [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "accessibility", href: "/accessibility" },
    { key: "terms", href: "/terms" },
  ],
};
