import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import { company } from "@/data/company";
import { listLeadership, leadershipConfigured } from "@/lib/leadership";

export async function generateMetadata() {
  const t = await getTranslations("pages.about");
  return { title: t("title"), description: t("intro") };
}

// A single display shape both the admin-managed (DynamoDB) roster and the
// static data/company.ts fallback are normalized into, so the JSX below
// doesn't need to care which source it came from.
type DisplayPerson = { key: string; name: string; title: string; bio: string | null; photoUrl: string | null };

async function getLeadershipToShow(): Promise<DisplayPerson[]> {
  if (leadershipConfigured()) {
    try {
      const people = await listLeadership();
      if (people.length > 0) {
        return people.map((p) => ({ key: p.id, name: p.name, title: p.title, bio: p.bio, photoUrl: p.photoUrl }));
      }
    } catch {
      // Falls through to the static fallback below — a DB hiccup should
      // never take down the About page.
    }
  }
  // Static fallback (data/company.ts) — used until the admin adds anyone
  // through the Leadership tab, or if the table isn't configured/reachable.
  return company.leadership.map((person) => ({
    key: person.name,
    name: person.name,
    title: person.title,
    bio: person.bio,
    photoUrl: person.photo ?? null,
  }));
}

export default async function AboutPage() {
  const t = await getTranslations("pages.about");
  const leadership = await getLeadershipToShow();

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <h2 className="text-2xl font-bold text-ink-900">{t("leadershipHeading")}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {leadership.map((person) => (
            <div
              key={person.key}
              className="group rounded-xl3 border border-ink-100 p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-soft"
            >
              {person.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.photoUrl}
                  alt={person.name}
                  className="mb-4 h-20 w-20 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div
                  className="mb-4 h-20 w-20 rounded-full bg-ink-100 transition-transform duration-200 group-hover:scale-105"
                  aria-hidden="true"
                />
              )}
              <h3 className="text-lg font-semibold text-ink-900">{person.name}</h3>
              <p className="text-sm text-ink-500">{person.title}</p>
              {/* Bio intentionally left blank when not provided — see
                  data/company.ts note: we never invent biography details. */}
              {person.bio && <p className="mt-2 text-sm text-ink-500">{person.bio}</p>}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

