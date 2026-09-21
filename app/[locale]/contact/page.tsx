import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import LeadForm from "@/components/forms/LeadForm";
import { company } from "@/data/company";
import { telHref, mailHref } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("pages.contact");
  return { title: t("title"), description: t("intro") };
}

export default async function ContactPage() {
  const t = await getTranslations("pages.contact");
  const tc = await getTranslations("common");

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl3 border border-ink-100 bg-white p-7 shadow-card sm:p-10">
            <LeadForm />
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl2 border border-ink-100 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{tc("callUsShort")}</h2>
              <a href={telHref(company.phone.e164)} className="mt-1 block text-lg font-semibold text-brand-blue">
                {company.phone.display}
              </a>
              <p className="mt-3 text-sm text-ink-700">{tc("hours")}</p>
            </div>
            <div className="rounded-xl2 border border-ink-100 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Email</h2>
              <a href={mailHref(company.email)} className="mt-1 block text-sm font-medium text-brand-blue">
                {company.email}
              </a>
            </div>
            <div className="rounded-xl2 border border-ink-100 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{tc("officeLocation")}</h2>
              <address className="mt-1 text-sm not-italic leading-relaxed text-ink-700">
                {company.address.line1}
                <br />
                {company.address.city}, {company.address.state} {company.address.zip}
              </address>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}

