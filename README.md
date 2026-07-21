# MC EHR

A practitioner-facing electronic health record built on FHIR, designed for the **mobile health clinic** use case — units that go into the field for chronic-disease management and vaccination, often in areas with unreliable connectivity and patients the clinic has never seen before.

Built with **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**, **Zod**, and **Chart.js**, running against a **FHIR R4** server.

## The problem it's built around

Most EHRs assume a fixed facility, a stable network, and a patient whose record already lives in the system. A mobile clinic breaks all three assumptions. Every design decision here comes back to one question: **what does a clinician need when the patient is in front of them, right now, on a tablet?** That framing drove the tablet-first layout, the emphasis on care plans (which surface the high-value services a mobile unit can perform), the duplicate-patient guard, and the encounter/vitals capture flow.

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit .env.local with your FHIR server
npm run dev
```

Open http://localhost:3000 — it redirects to `/patients`.

### FHIR server config

Configuration lives in `.env.local` (server-side only, never sent to the browser):

```
FHIR_BASE_URL=https://hapi.fhir.org/baseR4   # your FHIR R4 server, no trailing slash
FHIR_AUTH_TOKEN=                             # bearer token if the server requires auth
```

If a token is set it's sent as an `Authorization: Bearer` header on every request. For deployment (e.g. Vercel), set both as environment variables — `.env.local` is gitignored and won't carry over.

## Features

### Patient management

- **List, search, create, and edit** patients, with validation on both client and server (Zod): required fields, gender from the FHIR value set, date of birth not in the future.
- **Roster** sorted by last name, displayed as "Last, First Middle".
- **Duplicate-patient guard.** On create/edit, likely duplicates are flagged with a soft roadblock the clinician must acknowledge. Matching is **anchored on date of birth** with fuzzy (Jaro-Winkler) name comparison, so it catches misspellings and nicknames while keeping false positives low — a chronic problem for mobile clinics that see patients across multiple sites.

### Clinical chart

A single scrollable chart, ordered by clinical priority (medications & allergies → conditions → care plans → vitals → immunizations), with sticky in-page section navigation:

- **Medications** — active/flagged first, full history discoverable, with detected-issue flags surfaced.
- **Medication allergies** — a dedicated safety banner (or explicit "no known allergies").
- **Conditions** — active problems led, social/lifestyle factors and resolved items tucked behind toggles.
- **Vital signs** — per-vital widgets with the latest reading and a Chart.js trend line.
- **Care plans** — active plans surfaced, each linking to a detail view (below).
- **Immunizations** — doses grouped by vaccine (so annual flu shots don't drown the list), newest first, with dose counts and expandable dates.

### Care plan detail

Built for point-of-care decisions, not document review. Leads with **latest measurements** relevant to the plan (e.g. HbA1c for a diabetes plan), the **medications** prescribed against it, plan **activities**, and the **care team** with one-tap `tel:`/`mailto:` contacts.

It also **infers medication renewal cadence**: if a drug was renewed on a regular rhythm (e.g. a statin every ~12 months across nine prescriptions) and the current gap has run past that, it surfaces the pattern. Deliberately, it says *"no renewal recorded since…"* — **not "overdue."** Absence from *this* record isn't proof the patient wasn't renewed elsewhere, and "overdue" is a clinical judgment the app shouldn't assert. It states the fact and lets the clinician decide.

### Encounters (visits)

- **Create/finish lifecycle** — an encounter is `in-progress` while charting, then `finished`.
- **Vitals capture colocated with history** — each writable vital has a "this visit" input directly above its trend, so a reading is recorded with its context in view. Values **auto-save** (debounced, flushed on navigate/finish) as `Observation`s tied to the encounter; saving is an upsert so repeats don't duplicate. **BMI is derived** live from height and weight; **blood pressure** writes a proper panel Observation with systolic/diastolic components.
- Encounters are scoped to the clinic's own `Location` (a stand-in for auth, see below), so a patient's dozens of outside encounters don't clutter the view.

### Tablet-first UI & theming

- **Adaptive split view** — a persistent patient rail beside the chart in landscape (collapsible to a pull-tab to focus on the record), plain list↔detail navigation in portrait. Touch targets sized for fingers; grids driven by **container queries** so they respond to pane width, not just screen width.
- **Four color palettes + light/dark mode**, switchable live and applied before first paint (no flash), persisted per device.

## Notable engineering decisions

- **Server-only data layer, client-safe types.** All FHIR access (`lib/fhir/*.ts`) is marked `server-only` and runs in Server Components / Server Actions; view models and constants live in separate `*-types.ts` modules so client components never pull server code (or the FHIR base URL/token) into the browser bundle.
- **View models over raw FHIR.** FHIR resources are verbose and deeply nested; the UI works with flat view models, and mappers translate both ways. Edits patch the existing resource so unmanaged fields are preserved.
- **A shared chart body** (`PatientChartBody`) renders the same read-only sections on both the patient chart and the encounter view, so they can't drift; the encounter context flips the vitals section into an editable mode.
- **Fake auth, honestly labeled.** With no real authentication, "the logged-in clinic" is a single hardcoded `Location`, found-or-created idempotently by a business identifier. Replacing this with real auth is a named next step.
- **FHIR reality, not just the spec.** A couple of things the sandbox taught: the server *advertises* a `phonetic` search parameter that doesn't actually do phonetic matching (so fuzzy matching is done in-app), and an apparent `_include` "truncation" turned out to be a client bug, not the server. Duplicate detection and the (future) cross-system context pull are the same identity-matching problem at different scales.

## Architecture

```
src/
  app/
    layout.tsx                     app shell, theme switcher, no-flash script
    patients/
      layout.tsx                   adaptive split view (persistent rail)
      page.tsx                     roster / index
      actions.ts                   patient create/update, search, duplicate guard
      encounter-actions.ts         encounter create/finish, vitals auto-save
      [id]/page.tsx                patient chart
      [id]/encounters/…            encounters list + detail (vitals capture)
      care_plans/[id]/page.tsx     care plan detail
  components/patients/…            chart sections, rail, vitals grid, badges, etc.
  lib/
    fhir/                          server-only data access + client-safe *-types
      client.ts, resources.ts, patients.ts, medications.ts, vitals.ts,
      conditions.ts, allergies.ts, care-plan.ts, encounters.ts,
      encounter-vitals.ts, immunizations.ts, clinic.ts, duplicates.ts
    validation/patient.ts          Zod schema (shared client/server)
    utils/                         formatting + Jaro-Winkler similarity
```

## Next steps

This is a working prototype. The following are what I'd prioritize to make it viable for real field deployment, roughly in order.

### 1. Offline-first with deferred sync (highest priority)

**Why.** A mobile clinic's defining constraint is unreliable connectivity — rural routes, disaster response, urban dead zones. An EHR that hard-fails without a signal isn't usable in the field. The clinic has to register patients, run encounters, and chart vitals fully offline, then reconcile when a connection returns.

**Approach.** Persist resources and a queued mutation log in the browser (IndexedDB) behind a service worker, as an installable PWA, so the app shell and cached data work with no network. Submit deferred writes as FHIR `transaction` Bundles using `urn:uuid:` placeholder references — which lets interlinked resources (Patient + Encounter + Observations) be created offline with temporary ids and resolved server-side on submit — with conditional create (`If-None-Exist`) to keep replays idempotent.

**Hard part.** Conflict resolution when a record also changed server-side (version-aware updates via `ETag`/`If-Match`, then a per-field policy), and the reality that this is a genuine re-architecture: the current server-component/server-action design assumes connectivity, so data access would move client-side. The existing optimistic auto-save patterns are a first step in that direction.

### 2. Pre-fetched clinical context from regional systems (SMART / HIE)

**Why.** Patients arrive with no local record but usually have history elsewhere — nearby hospital systems, community health centers, HIEs. Because the clinic's route is known in advance, likely data sources can be identified and connected ahead of time, so context (allergies, active meds, problems) is ready before the patient is even seen.

**Approach.** Connect to each source with **SMART Backend Services** (system-to-system auth). Identify the patient with **`Patient/$match`** against each system's master patient index, then pull history with **`Patient/$everything`** and reconcile it into the local view. Maintain a registry of endpoints serving the planned geography — regional systems plus the nationwide frameworks (**TEFCA/QHINs, Carequality, CommonWell**; **IHE PDQm** for mobile patient discovery) — pre-authorized for each scheduled stop.

**Hard part.** Cross-organization **identity matching** (the same DOB-anchored, fuzzy-name problem as the in-app duplicate guard, one tier harder); endpoint onboarding; and **consent / purpose-of-use**. HIPAA permits disclosure for treatment without per-request consent, but real exchange is gated by state law, network opt-out/opt-in, and heightened protection for sensitive data (e.g. 42 CFR Part 2) — so the app must honor purpose-of-use and consent flags, not assume open access.

### Also on the roadmap

- **Real authentication and role-based access** — the "logged-in clinic" is currently a hardcoded `Location` standing in for auth.
- **Richer encounter documentation** beyond vitals — visit notes, procedures, and immunizations administered, captured against the encounter.
- **Dark-mode semantic-color audit and a test suite** for the FHIR mapping layer.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```
