# MO Behavior Therapy — Website

A Next.js 14 (App Router) + TypeScript + Tailwind marketing site for MO Behavior Therapy LLC, with full English/Spanish/Haitian Creole/Portuguese/French/German localization, a conversational intake assistant ("Milo"), and a lead pipeline (store → notify staff → confirm with the family).

This README covers: running it locally, every environment variable, how leads/emails/the AI assistant work, where to edit content, and how to deploy.

---

## 1. Run it locally

```bash
npm install
cp .env.example .env      # fill in what you have; see section 3 for what's required vs optional
npm run dev
```

Open http://localhost:3000. The site works immediately with **zero configuration** — leads are stored in a local JSON file (`data/leads.local.json`, gitignored) and emails are simply skipped (logged, not thrown) if no email provider is configured. Fill in `.env` incrementally as real credentials become available.

Useful scripts:

```bash
npm run build       # production build
npm run start       # run the production build
npm run lint        # eslint
npm run typecheck    # tsc --noEmit
```

---

## 2. What's real vs. what's a placeholder

This is a genuinely functional codebase, not a mockup — but a few things were explicitly left as clearly-marked extension points because they depend on decisions or assets only the client can provide:

| Item | Status | Where |
|---|---|---|
| Logo | **Placeholder** SVG mark. Swap for the real transparent logo the moment it's available. | `components/layout/Logo.tsx` |
| Photography | Placeholder blocks in the hero and a few sections. | `components/home/Hero.tsx` and similar |
| Brand hex colors | Best-effort palette derived from the flyer description. Confirm exact hex codes from the final brand guide. | `tailwind.config.ts` |
| Lead storage | Local JSON file by default; a full Postgres schema is ready to switch on. | `lib/leadStore.ts`, `prisma/schema.prisma` |
| Email delivery | Fully implemented for SMTP and Resend — just needs real credentials. | `lib/email.ts` |
| Milo (AI assistant) | **Fully functional without any external API** via deterministic slot-filling + entity extraction. Optionally upgraded with Claude for open-ended Q&A if `ANTHROPIC_API_KEY` is set. | `lib/chat/*`, `components/chat/ChatWidget.tsx` |
| Bot protection | Honeypot field is live. Turnstile/CAPTCHA has a clearly marked spot to plug in once you choose a provider. | `app/api/leads/route.ts` |
| Admin lead dashboard | Data model and status pipeline exist (`LeadStatus` in `prisma/schema.prisma`); the protected UI itself is not built — see section 8. | — |
| Insurance/staff logos | Text-based cards, not official insurer logos (avoids using their marks without a license). | `components/home/InsuranceSection.tsx` |
| Testimonials | Not included anywhere. Never fabricate these — add real, authorized ones later. | — |

Nothing here invents statistics, staff bios, accreditations, awards, additional office locations, or outcomes — all of that was explicitly off-limits per the brief.

---

## 3. Environment variables

See `.env.example` for the full, commented list. Summary:

**Always safe to leave blank for local dev:**
- Everything under "Email delivery", "Bot protection", "AI intake assistant", "Analytics", "Admin dashboard auth".

**Required before going to production:**
- `NEXT_PUBLIC_SITE_URL` — used for canonical URLs, sitemap, structured data.
- `COMPANY_NOTIFICATION_EMAIL` — defaults to mobehavior@mobehaviortherapy.com if unset.
- `EMAIL_PROVIDER` + matching credentials (`SMTP_*` or `RESEND_API_KEY`) — without this, leads are still stored but no emails go out.
- `DATABASE_URL` + `LEAD_STORE=prisma` — once you're ready to move off the local JSON file (see section 6).

---

## 4. How incoming leads work

1. A visitor submits through one of three places: the **Milo chat widget** (floating assistant), the **`/contact` page form**, or the mobile sticky bar's "Request" button (which routes to `/contact`).
2. The request hits `POST /api/leads` (`app/api/leads/route.ts`), which:
   - Rejects anything that fails validation (`lib/validation.ts`, using Zod) or trips the honeypot field.
   - **Stores the lead first** (`lib/leadStore.ts`) — this always happens before any email is attempted, so a lead is never lost to an email outage.
   - Sends the internal staff notification and the client confirmation email **in parallel, best-effort** (`Promise.allSettled`) — a failed email is logged but never fails the request or loses the lead.
3. Referrals (`/referral-sources`) and job applications (`/careers`) use the same pattern through their own endpoints (`/api/referrals`, `/api/careers`) and their own forms — kept separate from family intake per the brief.

Every lead includes a full consent record (given/not given, the exact consent text version, a timestamp, source page, UTM parameters, and referrer) — see the `consent` object in `lib/leadStore.ts`.

---

## 5. How the AI assistant (Milo) works

Milo is built to function as a real intake coordinator, not a scripted FAQ bot:

- **Entity extraction first.** Every message a visitor types is run through `lib/chat/extract.ts`, which uses regex to pull out ZIP code, age, insurance plan, phone, email, city, relationship ("mi hijo" → parent), and preferred setting — in all six languages. So a message like *"Hola, vivo en 34953, mi hijo tiene 6 años y tiene Florida Blue"* fills ZIP, age, insurance and relationship in one shot, and Milo only asks for what's still missing (phone, email, consent) — exactly as specified.
- **Slot-filling state machine** (`lib/chat/conversation.ts`) tracks what's still needed and asks one question at a time, never a 15-question wall.
- **Soft ZIP/service-area check** (`lib/zip-lookup.ts`) — tells the visitor whether they're in the usual service area, but **never blocks submission** either way.
- **Grounded free-text answers.** If a message looks like an open question rather than a slot answer, Milo tries `POST /api/chat` (`app/api/chat/route.ts`). Without `ANTHROPIC_API_KEY` set, this route simply returns `{ fallback: true }` and the widget keeps using its built-in flow — **Milo works fully with zero API key**. With a key set, it calls the Claude API with a system prompt (`lib/chat/systemPrompt.ts`) that's hard-grounded to only the approved company facts (services, insurance list, counties, hours, process) and explicitly forbidden from diagnosing, guaranteeing coverage, or inventing anything.
- **Emergency handling.** Any message matching crisis/emergency language (`isEmergencyMessage` in `extract.ts`) short-circuits straight to a message directing the visitor to call 911 — Milo never attempts crisis counseling.
- **On completion**, Milo submits directly to `/api/leads` — same store-then-notify-then-confirm pipeline as the contact form.
- **Consent** is always a separate, unchecked-by-default checkbox rendered right in the chat transcript before submission.

To swap the assistant's name, edit `chat.assistantName` in each `messages/<locale>.json` file — it's referenced from a single translation key everywhere (widget header, greeting, etc.), not hard-coded.

---

## 6. How company & client emails work

Both emails are implemented in `lib/email.ts`:

- **Internal notification** → `COMPANY_NOTIFICATION_EMAIL` (defaults to mobehavior@mobehaviortherapy.com), subject `NEW ABA INQUIRY – [Name] – [ZIP]`, formatted as a scannable table — deliberately excludes clinical narrative (only a Lead ID, so a future admin dashboard can carry the sensitive detail behind auth, not in an inbox).
- **Client confirmation** → sent to the email address the lead provided, **in their selected language** (all six languages have their own copy block in `lib/email.ts`), using the exact tone/content specified in the brief. Never includes diagnoses, member IDs, or health details.

Delivery is provider-agnostic: set `EMAIL_PROVIDER=smtp` (default; works with Google Workspace, Microsoft 365, Postmark SMTP, Amazon SES SMTP, etc.) or `EMAIL_PROVIDER=resend` and fill in the matching credentials in `.env`. If no credentials are set, sending simply fails silently and is logged — the lead itself is never lost.

---

## 7. Where to edit things

| What | File |
|---|---|
| Insurance plans shown on the site (add/remove a payer) | `data/insurance.ts` |
| Counties / cities served | `data/serviceAreas.ts` |
| Company contact info, hours, tagline | `data/company.ts` |
| Navigation links | `data/nav.ts` |
| FAQ question order | `data/faq.ts` — actual Q&A text lives in `messages/<locale>.json` under `faq.items` |
| English/Spanish/Haitian Creole/Portuguese/French/German copy | `messages/en.json`, `es.json`, `ht.json`, `pt.json`, `fr.json`, `de.json` — same key structure in every file |
| Brand colors | `tailwind.config.ts` → `theme.extend.colors.brand` |
| Milo's system prompt / grounding facts | `lib/chat/systemPrompt.ts` |
| Lead form fields | `components/forms/LeadForm.tsx` + `lib/validation.ts` |

**Adding a 7th language** is intentionally cheap: add the code to `locales` in `i18n.ts`, add it to `localeNames`, and add a `messages/<code>.json` file with the same keys as `en.json`. No component changes required — that's the whole point of the next-intl architecture used here.

---

## 8. Lead dashboard

Not built as a UI in this delivery, but the ground is laid:

- `prisma/schema.prisma` has a full `Lead` model with the exact status pipeline from the brief (`NEW` → … → `CLOSED`, including `NOT_ELIGIBLE_OUTSIDE_AREA`).
- `lib/leadStore.ts` already returns a structured `LeadRecord` for every submission — building a protected `/admin` route that lists/filters/updates these is the natural next step once you're on the Prisma backend (`LEAD_STORE=prisma`).
- Suggested auth approach for that route: the `ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` variables in `.env.example` are reserved for this.

---

## 9. Deployment

This is a standard Next.js 14 App Router project — it deploys cleanly to Vercel, or any Node host that supports Next's `output: 'standalone'` / a long-running Node process.

**Vercel (recommended, zero config):**
1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import it in Vercel.
3. Add the environment variables from `.env.example` in the Vercel project settings.
4. If using `LEAD_STORE=prisma`, provision a Postgres database (Vercel Postgres, Neon, Supabase, RDS, etc.), set `DATABASE_URL`, and run `npx prisma migrate deploy` as a build step or via the Vercel CLI.
5. Deploy.

**Any Node host:**
```bash
npm run build
npm run start   # serves on PORT (default 3000)
```

**Before going live, double-check:**
- `NEXT_PUBLIC_SITE_URL` matches the real domain (used in sitemap/canonical/structured data).
- Email provider credentials are real and `COMPANY_NOTIFICATION_EMAIL` is correct.
- `LEAD_STORE=prisma` + `DATABASE_URL` are set (the local JSON file store is for development only — most hosts have an ephemeral filesystem in production).
- Real logo/photography assets have replaced the placeholders (section 2).
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are set if you want CAPTCHA-grade bot protection beyond the built-in honeypot.

---

## 10. QC checklist run before this delivery

- ✅ Every internal link resolves to an existing route (14 top-level pages + insurance/city dynamic pages).
- ✅ All phone numbers use `tel:` links; all emails use `mailto:` links.
- ✅ Responsive: mobile sticky CTA bar, mobile nav, chat widget offset so it never overlaps the sticky bar.
- ✅ All six `messages/*.json` files validated as parseable JSON and checked for structural parity with `en.json`.
- ✅ Consent checkbox defaults unchecked everywhere (contact form, referral form, chat).
- ✅ No fabricated testimonials, stats, staff bios, accreditations, or office locations anywhere in the codebase.
- ✅ No secrets in client-side code — `lib/email.ts` and `lib/chat/systemPrompt.ts` are server-only, `ANTHROPIC_API_KEY`/SMTP credentials are only read in API routes.
- ✅ Emergency/crisis detection short-circuits the chat flow before any other logic runs.
- ✅ Lead storage happens before email attempts, and email failures are caught so they never lose or block a lead.
- ✅ SEO: sitemap.ts, robots.ts, Organization/LocalBusiness/FAQ/Breadcrumb/Service JSON-LD, per-page metadata.
- ⚠️ Not yet run against this delivery (needs the real deployment target): Lighthouse performance pass, full automated a11y audit (axe/Wave), and a native-speaker proofread of the ht/pt/fr/de copy beyond what was produced here — recommended before launch.

