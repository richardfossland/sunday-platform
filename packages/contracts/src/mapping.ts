import type { ServiceItemKind } from "./service.js";

/**
 * Cross-app vocabulary mapping for service-item kinds — the pure glue the
 * Plan→Stage bridge needs. Each app keeps its own local kind vocabulary; the
 * wire contract ([`ServiceItemKind`]) is the canonical superset. Producers map
 * their kind → canonical when emitting a `ServicePlan`; consumers map canonical
 * → their own rendering. Centralised here so no bridge invents its own mapping.
 *
 * Unknown inputs map to `custom` (forward-compatible: a new app-side kind never
 * throws, it degrades to a generic slide).
 */

/** SundayPlan's local kinds (template_item ∪ service_item, migration 0002). */
export type PlanServiceItemKind =
  | "welcome"
  | "worship_set"
  | "song"
  | "scripture"
  | "sermon"
  | "response"
  | "closing"
  | "announcement"
  | "gap";

/** SundayStage's local kinds (service_item, sql/0001_initial). */
export type StageServiceItemKind =
  | "song"
  | "scripture"
  | "custom_deck"
  | "video"
  | "announcement"
  | "gap";

const PLAN_TO_CANONICAL: Record<PlanServiceItemKind, ServiceItemKind> = {
  welcome: "welcome",
  worship_set: "song",
  song: "song",
  scripture: "scripture",
  sermon: "sermon",
  response: "response",
  closing: "custom",
  announcement: "announcement",
  gap: "gap",
};

const STAGE_TO_CANONICAL: Record<StageServiceItemKind, ServiceItemKind> = {
  song: "song",
  scripture: "scripture",
  custom_deck: "custom",
  video: "media",
  announcement: "announcement",
  gap: "gap",
};

/** How each canonical kind is presented in SundayStage (its local vocabulary). */
const CANONICAL_TO_STAGE: Record<ServiceItemKind, StageServiceItemKind> = {
  song: "song",
  scripture: "scripture",
  sermon: "custom_deck",
  reading: "scripture",
  prayer: "custom_deck",
  offering: "custom_deck",
  announcement: "announcement",
  welcome: "custom_deck",
  response: "custom_deck",
  media: "video",
  gap: "gap",
  custom: "custom_deck",
};

/** Map a SundayPlan kind to the canonical kind (unknown → `custom`). */
export function serviceItemKindFromPlan(kind: string): ServiceItemKind {
  // `kind` is untrusted (from another app's payload). Only OWN keys count, so a
  // lookup of "constructor"/"toString"/… returns "custom" instead of leaking an
  // inherited Object.prototype member where a ServiceItemKind is promised.
  return Object.prototype.hasOwnProperty.call(PLAN_TO_CANONICAL, kind)
    ? PLAN_TO_CANONICAL[kind as PlanServiceItemKind]
    : "custom";
}

/** Map a SundayStage kind to the canonical kind (unknown → `custom`). */
export function serviceItemKindFromStage(kind: string): ServiceItemKind {
  return Object.prototype.hasOwnProperty.call(STAGE_TO_CANONICAL, kind)
    ? STAGE_TO_CANONICAL[kind as StageServiceItemKind]
    : "custom";
}

/** Map a canonical kind to SundayStage's rendering vocabulary. */
export function serviceItemKindToStage(
  kind: ServiceItemKind,
): StageServiceItemKind {
  return CANONICAL_TO_STAGE[kind];
}
