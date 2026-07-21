import Link from "next/link";
import { notFound } from "next/navigation";

import { CarePlanMedications } from "@/components/patients/CarePlanMedications";
import { CarePlanStatusBadge } from "@/components/patients/CarePlanStatusBadge";
import { getCarePlanDetail } from "@/lib/fhir/care-plan";
import type {
  CarePlanActivity,
  CarePlanDetail,
  CareTeamMember,
  MonitoringFact,
} from "@/lib/fhir/care-plan-types";
import { FhirError } from "@/lib/fhir/client";
import type { ConditionView } from "@/lib/fhir/condition-types";
import { isActiveCondition } from "@/lib/fhir/condition-types";
import { formatDate, relativeFromNow, titleCase } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/**
 * Care plan detail.
 *
 * Built for the mobile-clinic case: the plan document itself is the least
 * interesting part, so the page leads with what a clinician could act on with
 * the patient in front of them — what's being monitored and when it was last
 * measured, what's prescribed, and who else to coordinate with.
 *
 * `[id]` is the CarePlan id.
 */
export default async function CarePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let plan: CarePlanDetail;
  try {
    plan = await getCarePlanDetail(id);
  } catch (err) {
    if (err instanceof FhirError && err.status === 404) notFound();
    throw err;
  }

  const backHref = plan.patientId ? `/patients/${plan.patientId}` : "/patients";

  return (
    <div className="@container flex flex-col gap-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground"
        >
          ← Back to patient
        </Link>
      </div>

      <PlanHeader plan={plan} />

      {/* Ordered by how likely a section is to be actionable with the patient
          in front of you: what's measurable now, then what's prescribable,
          then standing advice, then who to tell. */}
      {plan.monitoring.length > 0 && <Monitoring facts={plan.monitoring} />}
      {plan.medications.length > 0 && <CarePlanMedications medications={plan.medications} />}
      {plan.activities.length > 0 && <Activities activities={plan.activities} />}
      <CareTeam members={plan.careTeam} />
    </div>
  );
}

function PlanHeader({ plan }: { plan: CarePlanDetail }) {
  const started = plan.startDate ? formatDate(plan.startDate.slice(0, 10)) : null;
  const ended = plan.endDate ? formatDate(plan.endDate.slice(0, 10)) : null;
  const running = plan.status === "active" ? relativeFromNow(plan.startDate) : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
        <CarePlanStatusBadge status={plan.status} />
      </div>

      {/* The title falls back to the category when the plan has no title of its
          own, so only show the category when it adds something. */}
      {plan.category && plan.category !== plan.title && (
        <p className="mt-1 text-sm text-muted">{plan.category}</p>
      )}

      <p className="mt-2 text-sm text-muted">
        {started ? `Started ${started}` : "Start date unknown"}
        {ended && ` · Ended ${ended}`}
        {running && ` · ongoing ${running.replace(/ ago$/, "")}`}
      </p>

      {plan.conditions.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-muted">Addresses</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {plan.conditions.map((condition) => (
              <li key={condition.id}>
                <ConditionChip condition={condition} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConditionChip({ condition }: { condition: ConditionView }) {
  const active = isActiveCondition(condition);
  const tone = active
    ? "border-primary/30 bg-primary/5 text-foreground"
    : "border-border bg-background text-muted";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${tone}`}>
      {condition.name}
      {!active && condition.clinicalStatus && (
        <span className="text-xs">({condition.clinicalStatus})</span>
      )}
    </span>
  );
}

/**
 * Latest reading of each measure this plan implies. States the fact and how
 * long ago — no "overdue" judgement, which would be a clinical recommendation
 * we're not sourcing.
 */
function Monitoring({ facts }: { facts: MonitoringFact[] }) {
  return (
    <Section title="Latest measurements">
      <dl className="grid gap-4 @sm:grid-cols-2 @3xl:grid-cols-4">
        {facts.map((fact) => {
          const since = relativeFromNow(fact.date);
          return (
            <div key={fact.label} className="rounded-lg border border-border bg-background p-4">
              <dt className="text-xs uppercase tracking-wide text-muted">{fact.label}</dt>
              <dd className="mt-1 text-lg font-semibold">{fact.value ?? "—"}</dd>
              <dd className="mt-0.5 text-xs text-muted">
                {fact.date
                  ? `${formatDate(fact.date.slice(0, 10))}${since ? ` · ${since}` : ""}`
                  : "Never recorded"}
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

function Activities({ activities }: { activities: CarePlanActivity[] }) {
  return (
    <Section title="Plan activities">
      <ul className="flex flex-col gap-2">
        {activities.map((activity, i) => (
          <li
            key={`${activity.name}-${i}`}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{activity.name}</p>
              {activity.location && (
                <p className="mt-0.5 text-xs text-muted">{activity.location}</p>
              )}
            </div>
            {activity.status && (
              <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {activity.status.replace(/-/g, " ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Who else is managing this plan. Contact details are rendered as mailto:/tel:
 * links — in the field, reaching someone should be one tap, not a transcription.
 */
function CareTeam({ members }: { members: CareTeamMember[] }) {
  return (
    <Section title="Care team">
      {members.length === 0 ? (
        <p className="text-sm text-muted">No care team recorded for this plan.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={`${member.kind}-${member.id}`} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-baseline gap-2">
                <p className="font-medium">{member.name}</p>
                <span className="text-xs text-muted">
                  {member.kind === "organization" ? "Organization" : titleCase(member.role ?? "")}
                </span>
              </div>

              {member.address && <p className="mt-0.5 text-xs text-muted">{member.address}</p>}

              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 font-medium text-primary transition hover:bg-primary/5"
                  >
                    <span aria-hidden>✆</span> {member.phone}
                  </a>
                )}
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 font-medium text-primary transition hover:bg-primary/5"
                  >
                    <span aria-hidden>✉</span> {member.email}
                  </a>
                )}
                {!member.phone && !member.email && (
                  <span className="text-xs text-muted">No contact details on file</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}
