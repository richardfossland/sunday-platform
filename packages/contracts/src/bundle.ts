import { z } from "zod";

import {
  nullableField,
  safeRelPath,
  SCHEMA_VERSION,
  schemaVersionField,
  SundayApp,
} from "./common.js";
import { ServicePlan } from "./service.js";

/**
 * The offline export/import envelope — Sunday Bridge transport (d). A
 * `.sundaybundle` is plain JSON: portable, diffable, and the infrastructure-free
 * way to move a service plan (or, later, a recording manifest) between apps,
 * machines, or over email — no cloud account required. Media bytes are NOT
 * inlined; they sit next to the bundle at `media[].rel_path` (the user's own
 * storage), referenced by content hash for integrity.
 */
export const BundleKind = z.enum([
  "service_plan",
  "song_set",
  "recording_manifest",
  "generic",
]);
export type BundleKind = z.infer<typeof BundleKind>;

export const MediaItemKind = z.enum(["video", "audio", "image", "pdf", "other"]);
export type MediaItemKind = z.infer<typeof MediaItemKind>;

/** A media file shipped alongside a bundle (by reference, never inlined). */
export const MediaItem = z.object({
  /** Path relative to the bundle file. Must not be absolute or escape the dir. */
  rel_path: safeRelPath,
  /** e.g. "sha256:…" — null if not computed. */
  content_hash: nullableField(z.string()),
  byte_size: nullableField(z.number().int().min(0)),
  kind: MediaItemKind,
});
export type MediaItem = z.infer<typeof MediaItem>;

export const SundayBundle = z.object({
  schema_version: schemaVersionField,
  /** Bundle-format version, independent of the wire schema_version. */
  bundle_version: z.number().int().min(1),
  kind: BundleKind,
  /** ISO 8601 UTC creation time. */
  created_at: z.string(),
  source_app: SundayApp,
  church_id: nullableField(z.string().uuid()),
  media: z.array(MediaItem),
  /** Present when `kind === "service_plan"`. */
  service_plan: nullableField(ServicePlan),
});
export type SundayBundle = z.infer<typeof SundayBundle>;

/** Current `.sundaybundle` format version, independent of the wire schema. */
export const BUNDLE_VERSION = 1 as const;

/** Options for {@link writeServicePlanBundle}. */
export interface WriteServicePlanBundleOptions {
  /** The app authoring the bundle (Plan is the usual master). */
  sourceApp: SundayApp;
  /** Owning tenant, or null for a church-less export. */
  churchId: string | null;
  /** Media files shipped alongside (by reference, never inlined). */
  media?: MediaItem[];
  /** ISO 8601 UTC creation time; defaults to "now" so tests can pin it. */
  createdAt?: string;
}

/**
 * Wrap a {@link ServicePlan} in a `.sundaybundle` envelope ready to write to disk
 * (`JSON.stringify`). The result is a validated {@link SundayBundle} of kind
 * `service_plan`. Media is referenced, not inlined — the caller is responsible for
 * placing each `media[].rel_path` next to the bundle file.
 */
export function writeServicePlanBundle(
  servicePlan: ServicePlan,
  options: WriteServicePlanBundleOptions,
): SundayBundle {
  return SundayBundle.parse({
    schema_version: SCHEMA_VERSION,
    bundle_version: BUNDLE_VERSION,
    kind: "service_plan",
    created_at: options.createdAt ?? new Date().toISOString(),
    source_app: options.sourceApp,
    church_id: options.churchId,
    media: options.media ?? [],
    service_plan: servicePlan,
  });
}

/** The result of {@link readBundle}: either a parsed bundle or the parse errors. */
export interface ReadBundleResult {
  bundle: SundayBundle | null;
  /** Flat, human-readable problems — empty iff `bundle` is non-null. */
  errors: string[];
}

/**
 * Parse `.sundaybundle` JSON text into a validated {@link SundayBundle}. Never
 * throws: malformed JSON or a schema violation comes back as `{ bundle: null,
 * errors }`. Unknown fields are ignored (forward-compatible), matching the rest
 * of the contracts.
 */
export function readBundle(jsonText: string): ReadBundleResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return { bundle: null, errors: [`invalid JSON: ${(e as Error).message}`] };
  }

  const result = SundayBundle.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    });
    return { bundle: null, errors };
  }
  return { bundle: result.data, errors: [] };
}
