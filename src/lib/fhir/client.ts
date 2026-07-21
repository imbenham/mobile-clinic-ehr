import "server-only";
import type { Bundle, FhirResource, OperationOutcome } from "./resources";

/**
 * Minimal FHIR REST client.
 *
 * Wraps `fetch` with the FHIR base URL, the correct `Content-Type`/`Accept`
 * headers, optional bearer auth, and error handling that surfaces the
 * server's OperationOutcome message when something goes wrong.
 *
 * This module is server-only: the FHIR base URL and auth token live in
 * server-side env vars and never ship to the browser. UI code should call
 * FHIR through Server Components, Server Actions, or Route Handlers.
 */

const FHIR_BASE_URL = process.env.FHIR_BASE_URL ?? "https://hapi.fhir.org/baseR4";
const FHIR_AUTH_TOKEN = process.env.FHIR_AUTH_TOKEN;

const FHIR_JSON = "application/fhir+json";

export class FhirError extends Error {
  status: number;
  outcome?: OperationOutcome;

  constructor(message: string, status: number, outcome?: OperationOutcome) {
    super(message);
    this.name = "FhirError";
    this.status = status;
    this.outcome = outcome;
  }
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Accept", FHIR_JSON);
  if (FHIR_AUTH_TOKEN) {
    headers.set("Authorization", `Bearer ${FHIR_AUTH_TOKEN}`);
  }
  return headers;
}

/** Turn a FHIR OperationOutcome into a readable message. */
function outcomeMessage(outcome: OperationOutcome | undefined, fallback: string): string {
  const issue = outcome?.issue?.[0];
  return issue?.diagnostics ?? issue?.details?.text ?? fallback;
}

interface RequestOptions {
  /** URL path relative to the FHIR base, e.g. `Patient` or `Patient/123`. */
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /**
   * Query parameters — appended to the path for GET/search requests. An array
   * value is emitted as a repeated parameter, e.g. `{ "status:not": ["a", "b"] }`
   * → `status:not=a&status:not=b`.
   */
  searchParams?: Record<string, string | number | Array<string | number> | undefined>;
  /** FHIR resource body for POST/PUT. */
  body?: unknown;
  /** Next.js fetch cache/revalidation options. */
  next?: NextFetchRequestConfig;
  cache?: RequestCache;
}

async function request<T>({
  path,
  method = "GET",
  searchParams,
  body,
  next,
  cache,
}: RequestOptions): Promise<T> {
  const url = new URL(`${FHIR_BASE_URL}/${path.replace(/^\//, "")}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === "") continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = buildHeaders();
  if (body !== undefined) {
    headers.set("Content-Type", FHIR_JSON);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // FHIR data changes; don't cache by default. Callers can opt in via `next`.
    cache: cache ?? (next ? undefined : "no-store"),
    next,
  });

  // DELETE and some operations may return an empty body.
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const outcome = data as OperationOutcome | undefined;
    throw new FhirError(
      outcomeMessage(outcome, `FHIR request failed: ${res.status} ${res.statusText}`),
      res.status,
      outcome?.resourceType === "OperationOutcome" ? outcome : undefined,
    );
  }

  return data as T;
}

export const fhirClient = {
  /** Read a single resource by type and id. */
  read<T extends FhirResource>(
    resourceType: string,
    id: string,
    opts?: Pick<RequestOptions, "next" | "cache">,
  ): Promise<T> {
    return request<T>({ path: `${resourceType}/${id}`, ...opts });
  },

  /** Search a resource type, returning a Bundle. */
  async search<T extends FhirResource>(
    resourceType: string,
    searchParams?: RequestOptions["searchParams"],
    opts?: Pick<RequestOptions, "next" | "cache">,
  ): Promise<T[]> {
    return bundleResources(await request<Bundle<T>>({ path: resourceType, searchParams, ...opts }));
  },

  /** Count matches without fetching them (uses `_summary=count`). */
  async count(
    resourceType: string,
    searchParams?: RequestOptions["searchParams"],
    opts?: Pick<RequestOptions, "next" | "cache">,
  ): Promise<number> {
    const bundle = await request<Bundle<FhirResource>>({
      path: resourceType,
      searchParams: { ...searchParams, _summary: "count" },
      ...opts,
    });
    return bundle.total ?? 0;
  },

  /** Create a new resource (POST). Returns the created resource with server id. */
  create<T extends FhirResource>(resourceType: string, resource: T): Promise<T> {
    return request<T>({ path: resourceType, method: "POST", body: resource });
  },

  /** Update an existing resource (PUT). Requires `resource.id`. */
  update<T extends FhirResource & { id?: string }>(
    resourceType: string,
    resource: T,
  ): Promise<T> {
    if (!resource.id) {
      throw new Error("update() requires a resource with an id");
    }
    return request<T>({ path: `${resourceType}/${resource.id}`, method: "PUT", body: resource });
  },
};

/** Flatten a Bundle's entries into a plain array of resources. */
export function bundleResources<T extends FhirResource>(bundle: Bundle<T>): T[] {
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((r): r is T => r !== undefined);
}
