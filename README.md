# MC EHR

A practitioner-facing electronic health record (EHR) built on FHIR, for the FHIR coding challenge. Gives a clinician a single place to view and manage their patients.

Built with **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**, and **Zod**.

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
# FHIR_AUTH_TOKEN=                            # optional bearer token if the server needs auth
```

The default points at the **public HAPI FHIR R4 sandbox** so the app runs out of the box. Replace it with your challenge server when you have one. If a token is set, it's sent as an `Authorization: Bearer` header on every request.

## Features

### Week 1 — Patient management ✅

- **List** all patients (name, gender, date of birth, age)
- **Search** patients by name (debounced, URL-driven)
- **Create** patients via a validated form
- **Edit** existing patients and save back to FHIR
- Validation (client + server) via Zod: required fields, gender from a fixed set, DOB not in the future

### Week 2 — Patient details 🚧

- Demographics header + demographics grid are in place
- Vital signs, active conditions, and active medications are stubbed on the detail page — to be built out

## Project structure

```
src/
  app/
    layout.tsx                app shell (header/footer)
    page.tsx                  redirects to /patients
    patients/
      page.tsx                patient list + search
      actions.ts              server actions (create/update) with validation
      new/page.tsx            create form
      [id]/page.tsx           patient detail (demographics; Week 2 sections)
      [id]/edit/page.tsx      edit form
  components/
    ui/Field.tsx              labeled form field + input styles
    patients/PatientForm.tsx   shared create/edit form (client, useActionState)
    patients/PatientSearch.tsx debounced URL search box
  lib/
    fhir/
      client.ts               server-only FHIR REST client (fetch wrapper)
      patient-types.ts        client-safe constants + view models
      patients.ts             server-only Patient data access + mappers
    validation/patient.ts     Zod schema (shared client/server)
    utils/format.ts           date/age/text formatting helpers
```

### Design notes

- **Server-only data layer.** `client.ts` and `patients.ts` are marked `server-only`; FHIR access happens in Server Components and Server Actions. Shared constants/types live in `patient-types.ts` so client components can import them without pulling server code into the browser bundle.
- **View models over raw FHIR.** FHIR resources are verbose; the UI works with flat `PatientView` / `PatientFormData` shapes, and mappers translate to/from FHIR resources. Edits patch the existing resource so unmanaged fields (identifiers, contact info) are preserved.
- **Validation runs on the server** (authoritative) via Zod in the server actions, with matching HTML constraints for instant browser feedback.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```
