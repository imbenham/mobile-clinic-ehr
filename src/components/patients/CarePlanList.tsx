"use client";

import Link from "next/link";
import { useState } from "react";

import type { CarePlanListItem } from "@/lib/fhir/care-plan-types";
import { formatDate } from "@/lib/utils/format";

import { CarePlanStatusBadge } from "./CarePlanStatusBadge";

/**
 * Care plans section for the patient detail page.
 *
 * Leads with active care plans; the rest (completed, on-hold, draft) collapse
 * behind a toggle — same active-first / discoverable-history pattern as the
 * Medications and Conditions sections. Each row links to the care plan detail.
 */

function CarePlanRow({ plan, active }: { plan: CarePlanListItem; active: boolean }) {
  const started = plan.startDate ? formatDate(plan.startDate.slice(0, 10)) : null;
  const addresses =
    plan.conditionIds.length > 0
      ? `Addresses ${plan.conditionIds.length} condition${plan.conditionIds.length > 1 ? "s" : ""}`
      : null;

  return (
    <li>
      <Link
        href={`/patients/care_plans/${plan.carePlanId}`}
        className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40 hover:bg-background"
      >
        <div className="min-w-0">
          <p
            className={`font-medium group-hover:text-primary ${active ? "" : "text-muted"}`}
          >
            {plan.title}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {started ? `Started ${started}` : "Start date unknown"}
            {addresses && ` · ${addresses}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CarePlanStatusBadge status={plan.status} />
          <span aria-hidden className="text-muted transition group-hover:text-primary">
            ›
          </span>
        </div>
      </Link>
    </li>
  );
}

export function CarePlanList({ plans }: { plans: CarePlanListItem[] }) {
  const [showInactive, setShowInactive] = useState(false);

  const startTime = (p: CarePlanListItem) => new Date(p.startDate ?? 0).getTime();
  const byStartDesc = (a: CarePlanListItem, b: CarePlanListItem) => startTime(b) - startTime(a);

  const active = plans.filter((p) => p.status === "active").sort(byStartDesc);
  const inactive = plans.filter((p) => p.status !== "active").sort(byStartDesc);

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Care plans
          <span className="ml-2 font-normal text-muted/70">{active.length} active</span>
        </h2>
        {inactive.length > 0 && (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2.5 text-xs font-medium text-primary transition hover:bg-primary/5"
          >
            {showInactive ? "Hide inactive" : `Show inactive (${inactive.length})`}
          </button>
        )}
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-muted">No active care plans.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((p) => (
            <CarePlanRow key={p.carePlanId} plan={p} active />
          ))}
        </ul>
      )}

      {showInactive && inactive.length > 0 && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Inactive</p>
          <ul className="flex flex-col gap-2">
            {inactive.map((p) => (
              <CarePlanRow key={p.carePlanId} plan={p} active={false} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
